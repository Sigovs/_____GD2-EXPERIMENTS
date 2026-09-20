/*
 * route-editor.js — lay the route by hand on the still mountain (?edit=path). The intro is skipped, the scene sits on
 * its last frame with the line fully drawn.
 *
 *   click on the picture   — add a point at the end (the camp end)
 *   drag a point           — move it
 *   Backspace / Delete     — remove the last point
 *   Copy JSON              — the points, to bake into ROUTE.points (src/route.js)
 *   Reset                  — back to the baked points
 *
 * Saved in this browser (gd2.route.t9) and applied on the next load, so the page itself shows the edit.
 */
const KEY = 'gd2.route.t9';
const NS = 'http://www.w3.org/2000/svg';

export function applySavedRoute(route) {
	try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (Array.isArray(s) && s.length >= 2) route.setPoints(s); } catch {}
}

export function openRouteEditor({ route }) {
	const svg = route.svg, handles = route.handles;
	const baked = route.cfg.points.map((p) => [...p]);
	svg.style.pointerEvents = 'auto';
	// the panel
	const panel = document.createElement('div');
	panel.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:100;background:rgba(5,8,15,.9);color:#e8eef6;font:13px/1.5 Inter,system-ui,sans-serif;padding:12px 14px;border:1px solid rgba(255,255,255,.15);border-radius:8px;display:flex;flex-direction:column;gap:8px;max-width:340px;pointer-events:auto';
	panel.innerHTML = '<div style="font-weight:600">Route — click to add · drag to move · Backspace removes the last</div><div id="route-count"></div>';
	const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
	const btn = (label, fn) => { const b = document.createElement('button'); b.textContent = label; b.style.cssText = 'font:inherit;padding:4px 10px;border-radius:4px;border:1px solid rgba(255,255,255,.25);background:#111827;color:#e8eef6;cursor:pointer'; b.addEventListener('click', fn); row.append(b); return b; };
	const out = document.createElement('textarea'); out.readOnly = true; out.style.cssText = 'width:100%;height:70px;font:11px/1.4 ui-monospace,monospace;background:#0b1018;color:#cfd8e6;border:1px solid rgba(255,255,255,.15);border-radius:4px;padding:6px';
	btn('Copy JSON', () => { navigator.clipboard?.writeText(out.value); });
	btn('Reset', () => { route.setPoints(baked); save(); draw(); });
	btn('Clear', () => { route.setPoints(baked.slice(0, 2)); save(); draw(); });
	panel.append(row, out); document.body.append(panel);

	const pts = () => route.points;
	function save() { localStorage.setItem(KEY, JSON.stringify(pts().map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)]))); out.value = JSON.stringify(pts().map(([x, y]) => [+x.toFixed(3), +y.toFixed(3)])); panel.querySelector('#route-count').textContent = `${pts().length} points · summit → camp`; }
	function draw() {
		handles.innerHTML = '';
		pts().forEach(([x, y], i) => {
			const c = document.createElementNS(NS, 'circle');
			c.setAttribute('cx', x * 1920); c.setAttribute('cy', y * 1080); c.setAttribute('r', 11);
			c.setAttribute('fill', i === 0 ? 'rgba(151,200,44,.35)' : i === pts().length - 1 ? 'rgba(255,115,0,.35)' : 'rgba(255,255,255,.18)');
			c.setAttribute('stroke', '#97C82C'); c.setAttribute('stroke-width', '1.5'); c.style.cursor = 'grab'; c.dataset.i = i;
			handles.append(c);
		});
	}
	// screen → frame coordinates
	const toFrame = (clientX, clientY) => { const m = svg.getScreenCTM().inverse(); const p = new DOMPoint(clientX, clientY).matrixTransform(m); return [p.x / 1920, p.y / 1080]; };
	let drag = -1;
	svg.addEventListener('pointerdown', (e) => {
		const h = e.target.closest?.('circle[data-i]');
		if (h) { drag = +h.dataset.i; svg.setPointerCapture(e.pointerId); e.preventDefault(); return; }
		const [x, y] = toFrame(e.clientX, e.clientY);
		route.setPoints([...pts(), [x, y]]); save(); draw();
	});
	svg.addEventListener('pointermove', (e) => { if (drag < 0) return; const [x, y] = toFrame(e.clientX, e.clientY); const p = pts().map((q) => [...q]); p[drag] = [x, y]; route.setPoints(p); draw(); });
	svg.addEventListener('pointerup', () => { if (drag >= 0) { drag = -1; save(); } });
	window.addEventListener('keydown', (e) => { if ((e.key === 'Backspace' || e.key === 'Delete') && pts().length > 2 && document.activeElement === document.body) { route.setPoints(pts().slice(0, -1)); save(); draw(); e.preventDefault(); } });
	save(); draw();
	return { panel };
}
