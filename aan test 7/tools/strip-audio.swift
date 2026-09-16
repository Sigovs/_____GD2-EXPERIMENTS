// strip-audio.swift — remux an MP4 keeping only its video track (no re-encode).
// There is no ffmpeg on this machine; AVFoundation's passthrough export does the same job.
// Alex's standing rule: every video we generate ships silent.
//   swiftc -O tools/strip-audio.swift -o tools/strip-audio && tools/strip-audio in.mp4 out.mp4
import AVFoundation
import Foundation

let args = CommandLine.arguments
guard args.count == 3 else { print("usage: strip-audio <in.mp4> <out.mp4>"); exit(1) }
let asset = AVURLAsset(url: URL(fileURLWithPath: args[1]))
let comp = AVMutableComposition()
guard let source = asset.tracks(withMediaType: .video).first,
      let track = comp.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid) else {
	print("no video track"); exit(2)
}
do {
	try track.insertTimeRange(CMTimeRange(start: .zero, duration: asset.duration), of: source, at: .zero)
	track.preferredTransform = source.preferredTransform
} catch { print("insert failed: \(error)"); exit(3) }
guard let export = AVAssetExportSession(asset: comp, presetName: AVAssetExportPresetPassthrough) else { print("no export session"); exit(4) }
export.outputURL = URL(fileURLWithPath: args[2])
export.outputFileType = .mp4
let done = DispatchSemaphore(value: 0)
export.exportAsynchronously { done.signal() }
done.wait()
if export.status != .completed { print("export failed: \(String(describing: export.error))"); exit(5) }
print("ok")
