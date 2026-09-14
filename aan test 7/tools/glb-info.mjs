// Usage: node tools/glb-info.mjs path/to/file.glb
// Prints every mesh node with its transform, vertex/triangle count, attributes,
// local + world bounding box and world summit (highest vertex). No dependencies.
// World transform = the node's own TRS (parents are not walked — fine for
// single-mesh exports; for nested files check the printed parent chain).

import fs from 'node:fs';

const file = process.argv[2];
if (!file) { console.error('usage: node tools/glb-info.mjs file.glb'); process.exit(1); }

const buf = fs.readFileSync(file);
const jsonLen = buf.readUInt32LE(12);
const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString());
const binOffset = 20 + jsonLen + 8;

const COMP = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const NUM = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
function accessor(i) {
	const a = json.accessors[i];
	const bv = json.bufferViews[a.bufferView];
	const comp = COMP[a.componentType], n = NUM[a.type];
	const start = binOffset + (bv.byteOffset || 0) + (a.byteOffset || 0);
	const stride = bv.byteStride || comp * n;
	const out = new Array(a.count);
	for (let k = 0; k < a.count; k++) {
		const v = new Array(n);
		for (let c = 0; c < n; c++) {
			const o = start + k * stride + c * comp;
			v[c] = a.componentType === 5126 ? buf.readFloatLE(o)
				: a.componentType === 5123 ? buf.readUInt16LE(o)
				: a.componentType === 5125 ? buf.readUInt32LE(o)
				: a.componentType === 5121 ? buf.readUInt8(o)
				: a.componentType === 5122 ? buf.readInt16LE(o) : buf.readInt8(o);
		}
		out[k] = v;
	}
	return out;
}

function quatToMatrix([x, y, z, w]) {
	return [
		[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
		[2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
		[2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
	];
}
const f = (v) => v.map((x) => +x.toFixed(3));

const parentOf = new Map();
json.nodes.forEach((n, i) => (n.children || []).forEach((c) => parentOf.set(c, i)));

console.log(`file: ${file}`);
console.log(`generator: ${json.asset?.generator || '?'}   extensions: ${(json.extensionsUsed || []).join(', ') || '-'}`);
console.log(`materials: ${(json.materials || []).map((m) => m.name).join(', ') || '-'}`);
console.log(`images: ${(json.images || []).map((m) => m.name || m.uri || m.mimeType).join(', ') || '-'}`);

json.nodes.forEach((node, ni) => {
	if (node.mesh == null) return;
	const mesh = json.meshes[node.mesh];
	const t = node.translation || [0, 0, 0], r = node.rotation || [0, 0, 0, 1], s = node.scale || [1, 1, 1];
	const R = quatToMatrix(r);
	const chain = [];
	for (let p = parentOf.get(ni); p != null; p = parentOf.get(p)) chain.push(json.nodes[p].name || `#${p}`);

	let verts = 0, tris = 0;
	const lmin = [Infinity, Infinity, Infinity], lmax = [-Infinity, -Infinity, -Infinity];
	const wmin = [Infinity, Infinity, Infinity], wmax = [-Infinity, -Infinity, -Infinity];
	let summit = null;
	const attrs = new Set();
	for (const prim of mesh.primitives) {
		Object.keys(prim.attributes).forEach((a) => attrs.add(a));
		const pos = accessor(prim.attributes.POSITION);
		verts += pos.length;
		tris += (prim.indices != null ? json.accessors[prim.indices].count : pos.length) / 3;
		for (const p of pos) {
			for (let c = 0; c < 3; c++) { lmin[c] = Math.min(lmin[c], p[c]); lmax[c] = Math.max(lmax[c], p[c]); }
			const sc = [p[0] * s[0], p[1] * s[1], p[2] * s[2]];
			const w = [0, 1, 2].map((c) => R[c][0] * sc[0] + R[c][1] * sc[1] + R[c][2] * sc[2] + t[c]);
			for (let c = 0; c < 3; c++) { wmin[c] = Math.min(wmin[c], w[c]); wmax[c] = Math.max(wmax[c], w[c]); }
			if (!summit || w[1] > summit[1]) summit = w;
		}
	}
	console.log(`\nnode "${node.name}"  mesh "${mesh.name}"${chain.length ? `  (parents: ${chain.join(' > ')})` : ''}`);
	console.log(`  translation ${f(t)}  rotation(quat) ${f(r)}  scale ${f(s)}  extras ${JSON.stringify(node.extras || {})}`);
	console.log(`  vertices ${verts}  triangles ${tris}  attributes ${[...attrs].join(', ')}`);
	console.log(`  local bbox  min ${f(lmin)}  max ${f(lmax)}  size ${f(lmax.map((v, i) => v - lmin[i]))}`);
	console.log(`  world bbox  min ${f(wmin)}  max ${f(wmax)}  size ${f(wmax.map((v, i) => v - wmin[i]))}`);
	console.log(`  world summit (highest vertex) ${f(summit)}   → MAIN_MOUNTAIN.summit`);
});
