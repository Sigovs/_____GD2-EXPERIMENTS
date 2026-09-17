// hero-encode.swift — turn a generated take into a scroll-scrubbable hero film.
// There is no ffmpeg on this machine; AVFoundation does the whole job:
//   video only (Alex's standing rule: every video ships silent), HEVC -> H.264 (Chrome does not
//   decode HEVC everywhere), a short GOP so `video.currentTime = x` lands without decoding from
//   the start of the clip, moov at the front, and a poster frame at 25 % of the duration
//   (hero-scrub.js parks the film there before the first scroll; --at picks another fraction).
//   swiftc -O tools/hero-encode.swift -o tools/hero-encode
//   tools/hero-encode <in.mp4> <out.mp4> [poster.jpg] [--info] [--gop N] [--kbps N] [--at 0..1]
import AVFoundation
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

var args = Array(CommandLine.arguments.dropFirst())
var infoOnly = false, gop = 12, kbps = 6000, posterAt = 0.25
func take(_ flag: String) -> String? {
	guard let i = args.firstIndex(of: flag), i + 1 < args.count else { return nil }
	let v = args[i + 1]; args.removeSubrange(i...i + 1); return v
}
if let i = args.firstIndex(of: "--info") { infoOnly = true; args.remove(at: i) }
if let v = take("--gop"), let n = Int(v) { gop = n }
if let v = take("--kbps"), let n = Int(v) { kbps = n }
if let v = take("--at"), let f = Double(v) { posterAt = f }
guard args.count >= 1 else { print("usage: hero-encode <in.mp4> <out.mp4> [poster.jpg] [--info] [--gop N] [--kbps N] [--at 0..1]"); exit(1) }

let asset = AVURLAsset(url: URL(fileURLWithPath: args[0]))
guard let source = asset.tracks(withMediaType: .video).first else { print("no video track"); exit(2) }
let size = source.naturalSize.applying(source.preferredTransform)
let w = Int(abs(size.width)), h = Int(abs(size.height))
let fps = source.nominalFrameRate
let seconds = CMTimeGetSeconds(asset.duration)
print(String(format: "source: %dx%d  %.3f fps  %.2f s  %d kbps", w, h, fps, seconds, Int(source.estimatedDataRate / 1000)))
for case let fd as CMFormatDescription in source.formatDescriptions {
	let ext = CMFormatDescriptionGetExtensions(fd) as? [String: Any] ?? [:]
	let codec = CMFormatDescriptionGetMediaSubType(fd)
	let cc = String(bytes: [24, 16, 8, 0].map { UInt8((codec >> $0) & 0xff) }, encoding: .ascii) ?? "?"
	print("codec: \(cc)  depth: \(ext["BitsPerComponent"] ?? "8")  primaries: \(ext["CVImageBufferColorPrimaries"] ?? "-")  transfer: \(ext["CVImageBufferTransferFunction"] ?? "-")  matrix: \(ext["CVImageBufferYCbCrMatrix"] ?? "-")")
}
print("audio tracks: \(asset.tracks(withMediaType: .audio).count)")
if infoOnly { exit(0) }
guard args.count >= 2 else { print("need <out.mp4>"); exit(1) }
let outURL = URL(fileURLWithPath: args[1])
try? FileManager.default.removeItem(at: outURL)

// --- read: decoded frames, 8-bit 4:2:0, video range ---------------------------------------
let reader = try! AVAssetReader(asset: asset)
let readOut = AVAssetReaderTrackOutput(track: source, outputSettings: [
	kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange,
])
readOut.alwaysCopiesSampleData = false
reader.add(readOut)

// --- write: H.264 High, no B-frames (every seek is a forward decode), short GOP, faststart ---
let writer = try! AVAssetWriter(outputURL: outURL, fileType: .mp4)
writer.shouldOptimizeForNetworkUse = true
let writeIn = AVAssetWriterInput(mediaType: .video, outputSettings: [
	AVVideoCodecKey: AVVideoCodecType.h264,
	AVVideoWidthKey: w, AVVideoHeightKey: h,
	AVVideoColorPropertiesKey: [
		AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_709_2,
		AVVideoTransferFunctionKey: AVVideoTransferFunction_ITU_R_709_2,
		AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_709_2,
	],
	AVVideoCompressionPropertiesKey: [
		AVVideoAverageBitRateKey: kbps * 1000,
		AVVideoMaxKeyFrameIntervalKey: gop,
		AVVideoAllowFrameReorderingKey: false,
		AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
		AVVideoExpectedSourceFrameRateKey: Int(fps.rounded()),
	],
])
writeIn.expectsMediaDataInRealTime = false
writeIn.transform = source.preferredTransform
writer.add(writeIn)

guard reader.startReading(), writer.startWriting() else {
	print("start failed: \(reader.error?.localizedDescription ?? "") \(writer.error?.localizedDescription ?? "")"); exit(3)
}
writer.startSession(atSourceTime: .zero)
var frames = 0
let done = DispatchSemaphore(value: 0)
writeIn.requestMediaDataWhenReady(on: DispatchQueue(label: "encode")) {
	while writeIn.isReadyForMoreMediaData {
		guard let sb = readOut.copyNextSampleBuffer() else {
			writeIn.markAsFinished(); done.signal(); return
		}
		if !writeIn.append(sb) { print("append failed: \(writer.error?.localizedDescription ?? "?")"); exit(4) }
		frames += 1
	}
}
done.wait()
writer.finishWriting { done.signal() }
done.wait()
guard writer.status == .completed else { print("write failed: \(String(describing: writer.error))"); exit(5) }
let bytes = (try? FileManager.default.attributesOfItem(atPath: outURL.path)[.size] as? Int) ?? 0
print(String(format: "wrote %@: %d frames, gop %d, %.1f MB", outURL.lastPathComponent, frames, gop, Double(bytes) / 1_048_576))

// --- poster: the frame hero-scrub.js parks on (25 %) ----------------------------------------
if args.count >= 3 {
	let gen = AVAssetImageGenerator(asset: AVURLAsset(url: outURL))
	gen.appliesPreferredTrackTransform = true
	gen.requestedTimeToleranceBefore = .zero; gen.requestedTimeToleranceAfter = .zero
	let t = CMTimeMultiplyByFloat64(asset.duration, multiplier: posterAt)
	let cg = try! gen.copyCGImage(at: t, actualTime: nil)
	let posterURL = URL(fileURLWithPath: args[2])
	let dest = CGImageDestinationCreateWithURL(posterURL as CFURL, UTType.jpeg.identifier as CFString, 1, nil)!
	CGImageDestinationAddImage(dest, cg, [kCGImageDestinationLossyCompressionQuality: 0.82] as CFDictionary)
	CGImageDestinationFinalize(dest)
	let pb = (try? FileManager.default.attributesOfItem(atPath: posterURL.path)[.size] as? Int) ?? 0
	print(String(format: "poster %@ at %.2f s: %dx%d, %d KB", posterURL.lastPathComponent, CMTimeGetSeconds(t), cg.width, cg.height, pb / 1024))
}
print("ok")
