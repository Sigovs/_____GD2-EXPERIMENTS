/*
 * glow-editor.js — draw the tent's light by hand.
 *
 * Open the page with ?edit=glow (or press G). Scroll to where the tent is, then click around it:
 * every click adds a point, the points make the shape the glow is cast from (tent-glow.js blurs
 * THIS shape, in its stack of colours, instead of a circle). Drag a point to move it, right-click
 * one to delete it, Backspace drops the last, C clears. The glow updates live under the outline.
 *
 * The shape is stored RELATIVE to the tent — in tent widths from its tracked centroid — so it is
 * drawn once (at the last frame, ideally) and follows the tent through the film. "Copy" puts the
 * JSON on the clipboard; paste it into TENT_GLOW.shape in tent-glow.js to keep it. It is also kept
 * in localStorage so a reload does not lose the work in progress.
 */

/* saved dials -> the live cfg (used by the editor, and by the page on load so the work shows without the editor) */
import { applyGrade } from './tent-glow.js?v=2026-09-19r';

export function applySaved(cfg, saved) {
	if (!saved || Array.isArray(saved)) return;
	for (const k of ['intensity', 'spread', 'riseScale', 'blur', 'drift', 'parallax', 'anchor']) if (typeof saved[k] === 'number') cfg[k] = saved[k];
	for (const k of ['breath', 'tremble', 'flare', 'dodge', 'top', 'grade']) if (saved[k]) Object.assign(cfg[k], saved[k]);
	if (typeof saved.blend === 'string') cfg.blend = saved.blend;
	if (saved.palette) cfg.palette = { ...saved.palette };
	if (saved.shape) cfg.shape = saved.shape;
	if (cfg.grade) applyGrade(cfg.grade);
}

export function openGlowEditor({ glow, film }) {
	const cfg = glow.cfg;
	const KEY = 'gd2.tent-glow.t9';

	const ui = document.createElement('div');
	ui.innerHTML = `
		<canvas id="glow-editor-canvas" style="position:fixed;inset:0;width:100%;height:100%;z-index:50;cursor:crosshair"></canvas>
		<div id="glow-editor-panel" style="position:fixed;left:16px;bottom:16px;z-index:51;font:13px/1.5 ui-monospace,monospace;color:#e8eef6;background:rgba(5,8,15,.82);border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:12px 14px;max-width:380px;max-height:calc(100vh - 32px);overflow:auto">
			<div style="font-weight:600;margin-bottom:6px">Tent glow — shape editor</div>
			<div>click: add point · drag: move · right-click: delete · Backspace: last · C: clear · Esc: close</div>
			<div style="margin-top:8px;display:flex;gap:8px;align-items:center">
				<button id="glow-copy" style="font:inherit;padding:4px 10px;border-radius:6px;border:1px solid rgba(255,255,255,.25);background:#1c2634;color:#fff;cursor:pointer">Copy JSON</button>
				<button id="glow-toggle" style="font:inherit;padding:4px 10px;border-radius:6px;border:1px solid rgba(255,255,255,.25);background:#1c2634;color:#fff;cursor:pointer">Hide outline</button>
				<span id="glow-count"></span>
			</div>
			<div id="glow-dials" style="margin-top:10px;display:grid;grid-template-columns:auto 1fr auto;gap:4px 8px;align-items:center"></div>
			<textarea id="glow-json" readonly style="margin-top:8px;width:100%;height:56px;font:11px/1.4 ui-monospace,monospace;background:#0b1018;color:#9fb0c4;border:1px solid rgba(255,255,255,.1);border-radius:6px;resize:vertical"></textarea>
		</div>`;
	document.body.appendChild(ui);
	const canvas = ui.querySelector('#glow-editor-canvas'), ctx = canvas.getContext('2d');
	const panel = ui.querySelector('#glow-editor-panel');
	const count = ui.querySelector('#glow-count'), json = ui.querySelector('#glow-json');
	let outline = true;

	// the shape lives in cfg.shape (tent-relative); the editor works in screen px through the tent's frame
	let shape = cfg.shape && cfg.shape.length ? cfg.shape.map((p) => [...p]) : [];
	try {
		const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
		if (Array.isArray(saved)) { if (!shape.length) shape = saved; }
		else if (saved) { if (!shape.length && saved.shape) shape = saved.shape; applySaved(cfg, saved); }
	} catch {}
	cfg.shape = shape;

	function tentFrame() {
		const f = film.frame, tent = glow.tentAt(Math.max(f, cfg.track[0][0] + 1)) || glow.tentAt(cfg.track[cfg.track.length - 1][0]);
		const c = glow.cover(); const tw = tent.w * c.fw;
		return { cx: c.x + tent.u * c.fw, cy: c.y + tent.v * c.fh - tw * cfg.anchor, tw };
	}
	const toScreen = ([rx, ry]) => { const t = tentFrame(); return [t.cx + rx * t.tw, t.cy + ry * t.tw]; };
	const toRel = (x, y) => { const t = tentFrame(); return [+((x - t.cx) / t.tw).toFixed(4), +((y - t.cy) / t.tw).toFixed(4)]; };

	function resize() { canvas.width = innerWidth * devicePixelRatio; canvas.height = innerHeight * devicePixelRatio; }
	addEventListener('resize', resize); resize();

	const settings = () => ({ shape, intensity: cfg.intensity, spread: cfg.spread, riseScale: cfg.riseScale, blur: cfg.blur, breath: cfg.breath, tremble: cfg.tremble, flare: cfg.flare, drift: cfg.drift, parallax: cfg.parallax, anchor: cfg.anchor, palette: cfg.palette, blend: cfg.blend, dodge: cfg.dodge, top: cfg.top, grade: cfg.grade });
	function save() {
		cfg.shape = shape;
		try { localStorage.setItem(KEY, JSON.stringify(settings())); } catch {}
		count.textContent = shape.length + ' points';
		json.value = JSON.stringify(settings());
	}

	/* the dials: every one writes straight into the live glow (cfg) and is saved with the shape */
	// path, label, min, max, step, DEFAULT — the default is the module's own value, written here so Reset is a
	// real reset (the cfg has already taken the saved dials by the time the editor opens)
	const DIALS = [
		['intensity', 'Brightness', 0, 3, 0.01, 1], ['spread', 'Spread', 0.2, 2.5, 0.01, 1], ['riseScale', 'Rise', 0, 2.5, 0.01, 1], ['blur', 'Blur', 0.05, 1.5, 0.01, 0.55],
		['breath.depth', 'Breath', 0, 0.5, 0.01, 0.14], ['tremble.depth', 'Tremble', 0, 0.4, 0.01, 0.07], ['flare.depth', 'Flare', 0, 1, 0.01, 0.25], ['drift', 'Drift', 0, 0.15, 0.001, 0.035], ['parallax', 'Mouse lean', 0, 40, 1, 8], ['anchor', 'Anchor Y', -0.6, 0.6, 0.01, -0.02],
		// DODGE — a separate pass on its own canvas, mix-blend-mode: color-dodge
		['dodge.amount', 'Dodge', 0, 1, 0.01, 0], ['dodge.spread', 'Dodge spread', 0.2, 2.5, 0.01, 1], ['dodge.intensity', 'Dodge bright', 0, 3, 0.01, 1],
		// TOP — the light over the plate: stretched sideways
		['top.intensity', 'Top', 0, 1.5, 0.01, 0.26], ['top.stretch', 'Top stretch', 1, 5, 0.01, 2.6], ['top.squash', 'Top squash', 0.1, 1, 0.01, 0.42], ['top.spread', 'Top spread', 0.2, 2.5, 0.01, 0.9],
		// GRADE — the whole stage
		['grade.opacity', 'Grade amount', 0, 1, 0.01, 0.35], ['grade.contrast', 'Contrast', 0.6, 1.6, 0.01, 1.04], ['grade.saturate', 'Saturate', 0, 2, 0.01, 0.92], ['grade.brightness', 'Brightness*', 0.5, 1.5, 0.01, 1],
	];
	const BLENDS = ['normal', 'screen', 'plus-lighter', 'overlay', 'soft-light', 'hard-light', 'color-dodge', 'lighten'];
	const COLORS = [['core', 'Core', '#fefcc9'], ['mid', 'Mid', '#ffae34'], ['ember', 'Ember', '#451b0e']];
	const GRADE_BLENDS = ['multiply', 'soft-light', 'overlay', 'color', 'hue', 'luminosity', 'screen', 'color-dodge', 'color-burn', 'hard-light', 'normal'];
	const get = (path) => path.split('.').reduce((o, k) => o[k], cfg);
	const set = (path, v) => { const ks = path.split('.'); const o = ks.slice(0, -1).reduce((o, k) => o[k], cfg); o[ks[ks.length - 1]] = v; };
	const DEFAULTS = Object.fromEntries(DIALS.map(([path, , , , , def]) => [path, def]));
	const dials = ui.querySelector('#glow-dials');
	const row = (label, input, out) => { const l = document.createElement('label'); l.textContent = label; l.style.opacity = '.8'; dials.append(l, input, out); };
	const fmt = (v, step) => (+v).toFixed(step < 0.01 ? 3 : 2);
	DIALS.forEach(([path, label, min, max, step]) => {
		const inp = document.createElement('input'); inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; inp.value = get(path); inp.style.width = '150px';
		const out = document.createElement('span'); out.textContent = fmt(get(path), step); out.style.minWidth = '3.5em'; out.dataset.path = path;
		inp.addEventListener('input', () => { set(path, +inp.value); out.textContent = fmt(inp.value, step); if (path.startsWith('grade.')) applyGrade(cfg.grade); save(); });
		row(label, inp, out);
	});
	if (!cfg.palette) cfg.palette = Object.fromEntries(COLORS.map(([k, , v]) => [k, v]));
	COLORS.forEach(([k, label]) => {
		const inp = document.createElement('input'); inp.type = 'color'; inp.value = cfg.palette[k]; inp.style.width = '150px'; inp.style.height = '24px';
		const out = document.createElement('span'); out.textContent = cfg.palette[k]; out.dataset.color = k;
		inp.addEventListener('input', () => { cfg.palette[k] = inp.value; out.textContent = inp.value; glow.setPalette(cfg.palette); save(); });
		row(label, inp, out);
	});
	glow.setPalette(cfg.palette);
	// the GRADE's colour and blend
	{
		const inp = document.createElement('input'); inp.type = 'color'; inp.value = cfg.grade.color; inp.style.width = '150px'; inp.style.height = '24px';
		const out = document.createElement('span'); out.textContent = cfg.grade.color; out.dataset.gradeColor = '1';
		inp.addEventListener('input', () => { cfg.grade.color = inp.value; out.textContent = inp.value; applyGrade(cfg.grade); save(); });
		row('Grade colour', inp, out);
		const sel = document.createElement('select'); sel.style.cssText = 'width:150px;font:inherit;background:#0b1018;color:#e8eef6;border:1px solid rgba(255,255,255,.2);border-radius:4px;padding:2px 4px';
		GRADE_BLENDS.forEach((b) => { const o = document.createElement('option'); o.value = b; o.textContent = b; sel.append(o); });
		sel.value = cfg.grade.blend;
		sel.addEventListener('change', () => { cfg.grade.blend = sel.value; applyGrade(cfg.grade); save(); });
		row('Grade blend', sel, document.createElement('span'));
	}
	// the stack's own blend with the film (CSS mix-blend-mode on the glow canvas)
	{
		const sel = document.createElement('select'); sel.style.cssText = 'width:150px;font:inherit;background:#0b1018;color:#e8eef6;border:1px solid rgba(255,255,255,.2);border-radius:4px;padding:2px 4px';
		BLENDS.forEach((b) => { const o = document.createElement('option'); o.value = b; o.textContent = b; sel.append(o); });
		sel.value = cfg.blend || 'normal';
		const out = document.createElement('span'); out.textContent = ''; out.dataset.blend = '1';
		sel.addEventListener('change', () => { cfg.blend = sel.value; save(); });
		row('Blend', sel, out);
	}
	function syncDials() {
		const sel = dials.querySelector('select'); if (sel) sel.value = cfg.blend || 'normal';
		[...dials.querySelectorAll('input[type=range]')].forEach((inp, i) => { const [path, , , , step] = DIALS[i]; inp.value = get(path); dials.querySelector('span[data-path="' + path + '"]').textContent = fmt(get(path), step); });
		[...dials.querySelectorAll('input[type=color]')].forEach((inp, i) => { const k = COLORS[i][0]; inp.value = cfg.palette[k]; dials.querySelector('span[data-color="' + k + '"]').textContent = cfg.palette[k]; });
	}
	const reset = document.createElement('button'); reset.textContent = 'Reset dials'; reset.style.cssText = 'font:inherit;padding:3px 8px;border-radius:6px;border:1px solid rgba(255,255,255,.25);background:#1c2634;color:#fff;cursor:pointer;grid-column:1/-1;justify-self:start';
	reset.addEventListener('click', () => { DIALS.forEach(([path]) => set(path, DEFAULTS[path])); cfg.palette = Object.fromEntries(COLORS.map(([k, , v]) => [k, v])); cfg.blend = 'normal'; glow.setPalette(cfg.palette); syncDials(); save(); });
	dials.append(reset);

	function draw() {
		ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
		ctx.clearRect(0, 0, innerWidth, innerHeight);
		if (!outline) return requestAnimationFrame(draw);
		const pts = shape.map(toScreen);
		if (pts.length) {
			ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
			if (pts.length > 2) ctx.closePath();
			ctx.strokeStyle = 'rgba(151,200,44,.95)'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);
			pts.forEach(([x, y], i) => { ctx.beginPath(); ctx.arc(x, y, i === drag ? 7 : 5, 0, Math.PI * 2); ctx.fillStyle = i === drag ? '#fff' : '#97c82c'; ctx.fill(); ctx.strokeStyle = '#05080f'; ctx.lineWidth = 1.5; ctx.stroke(); });
		}
		// the tent's tracked centre, for reference
		const t = tentFrame();
		ctx.beginPath(); ctx.moveTo(t.cx - 8, t.cy); ctx.lineTo(t.cx + 8, t.cy); ctx.moveTo(t.cx, t.cy - 8); ctx.lineTo(t.cx, t.cy + 8);
		ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1; ctx.stroke();
		requestAnimationFrame(draw);
	}
	requestAnimationFrame(draw);

	let drag = -1, moved = false;
	const hit = (x, y) => { const pts = shape.map(toScreen); for (let i = pts.length - 1; i >= 0; i--) { const [px, py] = pts[i]; if (Math.hypot(px - x, py - y) < 10) return i; } return -1; };
	canvas.addEventListener('pointerdown', (e) => {
		if (e.button === 2) return;
		const i = hit(e.clientX, e.clientY);
		if (i >= 0) { drag = i; moved = false; canvas.setPointerCapture(e.pointerId); }
	});
	canvas.addEventListener('pointermove', (e) => { if (drag < 0) return; moved = true; shape[drag] = toRel(e.clientX, e.clientY); save(); });
	canvas.addEventListener('pointerup', (e) => {
		if (drag >= 0) { drag = -1; if (moved) return; return; }
		if (e.button !== 0) return;
		shape.push(toRel(e.clientX, e.clientY)); save();
	});
	canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); const i = hit(e.clientX, e.clientY); if (i >= 0) { shape.splice(i, 1); save(); } });
	addEventListener('keydown', (e) => {
		if (e.target && ['TEXTAREA', 'INPUT'].includes(e.target.tagName)) return;
		if (e.key === 'Backspace') { shape.pop(); save(); }
		if (e.key === 'c' || e.key === 'C') { shape.length = 0; save(); }
		if (e.key === 'Escape') { ui.remove(); }
	});
	ui.querySelector('#glow-copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(JSON.stringify(settings())); ui.querySelector('#glow-copy').textContent = 'Copied'; setTimeout(() => (ui.querySelector('#glow-copy').textContent = 'Copy JSON'), 1200); } catch { json.select(); } });
	ui.querySelector('#glow-toggle').addEventListener('click', (e) => { outline = !outline; e.target.textContent = outline ? 'Hide outline' : 'Show outline'; });
	// the wheel must still scroll the film under the editor
	canvas.addEventListener('wheel', (e) => { window.scrollBy(0, e.deltaY); }, { passive: true });
	save();
	return { close: () => ui.remove(), get shape() { return shape; } };
}
