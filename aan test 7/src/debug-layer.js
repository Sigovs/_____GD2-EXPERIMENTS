import * as THREE from 'three';

/*
 * Temporary debug overlay. OFF by default.
 * Enable with `?debug` in the URL or press `D`.
 *
 * Shows: world axes, ground grid, main mountain bounding box, baby mountain
 * bounding boxes, summit marker, hero camera + look-at, the camera / target
 * paths authored in the GLB, and the orbit rings for zoom min / 1 / max.
 * Everything is drawn on top (no depth test) so it stays readable through clouds.
 */

const COLORS = {
	mainBox: 0xffcc00,
	babyBox: 0x00e5ff,
	summit: 0xff00aa,
	camera: 0x2a6bd6,
	lookAt: 0xff7a1a,
	cameraPath: 0x2a6bd6,
	targetPath: 0xff7a1a,
	orbit: 0x30c46a,
};

function onTop(material) {
	material.depthTest = false;
	material.depthWrite = false;
	material.transparent = true;
	return material;
}

function lineFromPoints(points, color, closed = false) {
	const pts = closed ? [...points, points[0]] : points;
	const geometry = new THREE.BufferGeometry().setFromPoints(pts);
	return new THREE.Line(geometry, onTop(new THREE.LineBasicMaterial({ color })));
}

function marker(position, color, radius = 2) {
	const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 8), onTop(new THREE.MeshBasicMaterial({ color })));
	mesh.position.copy(position);
	return mesh;
}

function ring(center, radius, y, color, segments = 96) {
	const pts = [];
	for (let i = 0; i < segments; i++) {
		const a = (i / segments) * Math.PI * 2;
		pts.push(new THREE.Vector3(center.x + Math.cos(a) * radius, y, center.z + Math.sin(a) * radius));
	}
	return lineFromPoints(pts, color, true);
}

function boxHelper(object, color) {
	const box = new THREE.Box3().setFromObject(object);
	const helper = new THREE.Box3Helper(box, color);
	onTop(helper.material);
	helper.userData.box = box;
	return helper;
}

/**
 * @param {object} p
 * @param {THREE.Object3D} p.mountain        main mountain mesh (world transform applied)
 * @param {THREE.Object3D[]} p.babies        baby mountain meshes
 * @param {THREE.Vector3} p.summit           world summit
 * @param {THREE.Vector3} p.pivot            orbit pivot
 * @param {THREE.Vector3} p.cameraPosition   hero camera position (zoom 1, angle 0)
 * @param {THREE.Vector3} p.cameraLookAt     hero look-at
 * @param {number} p.zoomMin
 * @param {number} p.zoomMax
 * @param {THREE.Vector3[]} [p.cameraPath]   authored camera path (GLB), optional
 * @param {THREE.Vector3[]} [p.targetPath]   authored look-at path (GLB), optional
 */
export function createDebugLayer(p) {
	const group = new THREE.Group();
	group.name = 'DebugLayer';
	group.visible = false;
	group.renderOrder = 100;

	// World axes (X red, Y green, Z blue) and a ground grid at the mountain's lowest point
	const axes = new THREE.AxesHelper(80);
	onTop(axes.material);
	group.add(axes);

	const mainBox = boxHelper(p.mountain, COLORS.mainBox);
	group.add(mainBox);

	const grid = new THREE.GridHelper(600, 12, 0x888888, 0xcccccc);
	onTop(grid.material);
	grid.position.y = mainBox.userData.box.min.y;
	group.add(grid);

	const babyBoxes = p.babies.map((b) => boxHelper(b, COLORS.babyBox));
	group.add(...babyBoxes);

	// Summit: sphere + vertical drop line to the grid
	group.add(marker(p.summit, COLORS.summit, 2.5));
	group.add(lineFromPoints([p.summit.clone(), new THREE.Vector3(p.summit.x, grid.position.y, p.summit.z)], COLORS.summit));

	// Hero camera, look-at, and the view line between them
	group.add(marker(p.cameraPosition, COLORS.camera, 3));
	group.add(marker(p.cameraLookAt, COLORS.lookAt, 2));
	group.add(lineFromPoints([p.cameraPosition, p.cameraLookAt], COLORS.camera));

	// Orbit rings: camera positions for zoom min / 1 / max (angle sweeps 0..360°)
	const offset = p.cameraPosition.clone().sub(p.pivot);
	const r = Math.hypot(offset.x, offset.z);
	for (const z of [p.zoomMin, 1, p.zoomMax]) {
		group.add(ring(p.pivot, r * z, p.pivot.y + offset.y * z, COLORS.orbit));
	}

	// Authored paths from the GLB (camera spline + look-at spline)
	if (p.cameraPath?.length) group.add(lineFromPoints(p.cameraPath, COLORS.cameraPath));
	if (p.targetPath?.length) group.add(lineFromPoints(p.targetPath, COLORS.targetPath));

	group.traverse((o) => { o.renderOrder = 100; });

	const report = {
		mainBoundingBox: { min: mainBox.userData.box.min.toArray(), max: mainBox.userData.box.max.toArray(), size: mainBox.userData.box.getSize(new THREE.Vector3()).toArray() },
		babyBoundingBoxes: babyBoxes.map((b, i) => ({
			name: p.babies[i].name,
			min: b.userData.box.min.toArray(), max: b.userData.box.max.toArray(), size: b.userData.box.getSize(new THREE.Vector3()).toArray(),
		})),
		summit: p.summit.toArray(),
		pivot: p.pivot.toArray(),
		heroCamera: { position: p.cameraPosition.toArray(), lookAt: p.cameraLookAt.toArray(), orbitRadius: r, height: p.cameraPosition.y },
		orbitRadiusRange: [r * p.zoomMin, r * p.zoomMax],
	};

	return {
		group,
		report,
		toggle(force) {
			group.visible = typeof force === 'boolean' ? force : !group.visible;
			if (group.visible) console.table ? console.log('[debug] scene report', report) : null;
			return group.visible;
		},
	};
}
