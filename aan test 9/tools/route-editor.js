/*
 * tools/route-editor.js — lay the descent route on the film by hand, key by key.
 *
 * State: a working copy of route-config.js → keys (ridge / camp / tent per key), autosaved to
 * localStorage. The film is scrubbed to any time; at a key the points are editable, between
 * keys they are shown interpolated (the page's own interpolation: route-layer.js renders
 * underneath with the live keys). Export = the `keys` block + the glow keys, ready to paste
 * into src/route-config.js. Nothing here writes the config.
 */
import { ROUTE } from '../src/route-config.js';
import { createRouteLayer } from '../src/route-layer.js';

const $ = (s) => document.querySelector(s);
const video = $('#film'), edit = $('#edit'), ectx = edit.getContext('2d');
const STORE = 'route-editor:keys:v1';
const CHAINS = ['ridge', 'camp'];
const COLOR = { ridge: '#37d6ff', camp: '#ffa64d', tent: '#ffd84d' };

/* ---- state ---- */
const fromConfig = () => ({
	keys: ROUTE.keys.map((k) => ({ f: k.f, ridge: k.ridge.map((p) => [...p]), camp: k.camp.map((p) => [...p]), alpha: k.alpha ? JSON.parse(JSON.stringify(k.alpha)) : undefined,
		tent: [...(ROUTE.glow.keys.find((g) => Math.abs(g[0] - k.f) < 1e-6)?.[1] ?? interpGlow(k.f))] })),
});
function interpGlow(f) {
	const g = ROUTE.glow.keys;
	if (f <= g[0][0]) return g[0][1];
	for (let i = 1; i < g.length; i++) if (f <= g[i][0]) { const a = g[i - 1], b = g[i], t = (f - a[0]) / (b[0] - a[0]); return [a[1][0] + (b[1][0] - a[1][0]) * t, a[1][1] + (b[1][1] - a[1][1]) * t]; }
	return g[g.length - 1][1];
}
let state;
try { state = JSON.parse(localStorage.getItem(STORE)); } catch { state = null; }
if (!state || !state.keys) state = fromConfig();
let keyIndex = 0, chain = 'ridge', sel = -1, f = state.keys[0].f;
let onion = true, showGrid = false;
let allKeys = true;   // a move applies to every key (the default) or to this key only
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch {} };

/* ---- the frame box (object-fit: contain) ---- */
let box = { x: 0, y: 0, w: 1, h: 1 };
function measure() {
	const r = edit.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
	edit.width = Math.round(r.width * dpr); edit.height = Math.round(r.height * dpr);
	ectx.setTransform(dpr, 0, 0, dpr, 0, 0);
	const vw = video.videoWidth || 1920, vh = video.videoHeight || 1080, k = Math.min(r.width / vw, r.height / vh);
	box = { x: (r.width - vw * k) / 2, y: (r.height - vh * k) / 2, w: vw * k, h: vh * k, W: r.width, H: r.height };
}
const toPx = ([x, y]) => [box.x + x / 100 * box.w, box.y + y / 100 * box.h];
const toFilm = (px, py) => [(px - box.x) / box.w * 100, (py - box.y) / box.h * 100];

/* ---- the real render underneath: the page's own layer on the live keys ---- */
measure();
const layer = createRouteLayer({ canvas: $('#route'), video, labelRoot: document.createElement('div'), fit: 'contain', size: () => ({ w: box.W, h: box.H }) });
function pushKeys() {
	const keys = state.keys.map((k) => ({ f: k.f, ridge: k.ridge, camp: k.camp, ...(k.alpha ? { alpha: k.alpha } : {}) }));
	const glow = state.keys.map((k) => [k.f, k.tent]);
	layer.setKeys(keys, glow);
}

/* ---- interpolation for the onion / off-key display (mirrors route-layer.js) ---- */
function pointsAt(ch, t) {
	const k = state.keys;
	if (t <= k[0].f) return k[0][ch];
	for (let i = 1; i < k.length; i++) if (t <= k[i].f) { const a = k[i - 1], b = k[i], q = (t - a.f) / (b.f - a.f); return a[ch].map((p, j) => [p[0] + (b[ch][j][0] - p[0]) * q, p[1] + (b[ch][j][1] - p[1]) * q]); }
	return k[k.length - 1][ch];
}
const atKey = () => Math.abs(state.keys[keyIndex].f - f) < 1e-6;

/* ---- draw the overlay ---- */
function draw() {
	ectx.clearRect(0, 0, box.W, box.H);
	if (showGrid) {
		ectx.strokeStyle = 'rgba(255,255,255,0.18)'; ectx.fillStyle = 'rgba(255,255,255,0.7)'; ectx.font = '11px ui-monospace, monospace'; ectx.lineWidth = 1;
		for (let i = 10; i < 100; i += 10) { const [x] = toPx([i, 0]), [, y] = toPx([0, i]); ectx.beginPath(); ectx.moveTo(x, box.y); ectx.lineTo(x, box.y + box.h); ectx.stroke(); ectx.beginPath(); ectx.moveTo(box.x, y); ectx.lineTo(box.x + box.w, y); ectx.stroke(); ectx.fillText(i, x + 3, box.y + 12); ectx.fillText(i, box.x + 3, y - 3); }
	}
	// onion: the neighbouring keys' points, faint
	if (onion && atKey()) for (const d of [-1, 1]) {
		const k = state.keys[keyIndex + d]; if (!k) continue;
		for (const ch of CHAINS) { ectx.strokeStyle = COLOR[ch]; ectx.globalAlpha = 0.28; ectx.lineWidth = 1; ectx.setLineDash([4, 5]);
			ectx.beginPath(); k[ch].forEach((p, i) => { const [x, y] = toPx(p); i ? ectx.lineTo(x, y) : ectx.moveTo(x, y); }); ectx.stroke(); ectx.setLineDash([]); ectx.globalAlpha = 1; }
	}
	// the chains at the current time
	for (const ch of CHAINS) {
		const pts = atKey() ? state.keys[keyIndex][ch] : pointsAt(ch, f);
		const alphas = atKey() ? (state.keys[keyIndex].alpha?.[ch] ?? ROUTE.chains[ch].alpha) : ROUTE.chains[ch].alpha;
		ectx.strokeStyle = COLOR[ch]; ectx.lineWidth = ch === chain ? 1.5 : 1; ectx.globalAlpha = ch === chain ? 0.9 : 0.5;
		ectx.beginPath(); pts.forEach((p, i) => { const [x, y] = toPx(p); i ? ectx.lineTo(x, y) : ectx.moveTo(x, y); }); ectx.stroke();
		pts.forEach((p, i) => {
			const [x, y] = toPx(p), hidden = (alphas[i] ?? 1) <= 0.01, on = ch === chain && i === sel;
			ectx.globalAlpha = 1; ectx.lineWidth = on ? 2 : 1;
			ectx.beginPath(); ectx.rect(x - (on ? 6 : 4), y - (on ? 6 : 4), on ? 12 : 8, on ? 12 : 8);
			if (hidden) { ectx.strokeStyle = COLOR[ch]; ectx.stroke(); } else { ectx.fillStyle = on ? '#fff' : COLOR[ch]; ectx.fill(); }
			if (ch === chain) { ectx.fillStyle = 'rgba(255,255,255,0.85)'; ectx.font = '11px ui-monospace, monospace'; ectx.fillText(i, x + 8, y - 8); }
		});
		ectx.globalAlpha = 1;
	}
	// the tent
	const tent = atKey() ? state.keys[keyIndex].tent : interpTent(f);
	const [tx, ty] = toPx(tent);
	ectx.strokeStyle = COLOR.tent; ectx.lineWidth = chain === 'tent' ? 2 : 1; ectx.globalAlpha = chain === 'tent' ? 1 : 0.6;
	ectx.beginPath(); ectx.arc(tx, ty, 9, 0, Math.PI * 2); ectx.stroke(); ectx.beginPath(); ectx.moveTo(tx - 13, ty); ectx.lineTo(tx + 13, ty); ectx.moveTo(tx, ty - 13); ectx.lineTo(tx, ty + 13); ectx.stroke();
	ectx.globalAlpha = 1;
}
function interpTent(t) { const k = state.keys; if (t <= k[0].f) return k[0].tent; for (let i = 1; i < k.length; i++) if (t <= k[i].f) { const a = k[i - 1], b = k[i], q = (t - a.f) / (b.f - a.f); return [a.tent[0] + (b.tent[0] - a.tent[0]) * q, a.tent[1] + (b.tent[1] - a.tent[1]) * q]; } return k[k.length - 1].tent; }

/* ---- the film ---- */
let seekQueued = null;
function seek(t) {
	f = Math.min(1, Math.max(0, t));
	$('#ftime').textContent = 'f ' + f.toFixed(3);
	$('#scrub').value = Math.round(f * 1000);
	if (!video.duration) return;
	if (video.seeking) { seekQueued = f; return; }
	video.currentTime = f * video.duration;
}
video.addEventListener('seeked', () => { if (seekQueued !== null) { const q = seekQueued; seekQueued = null; video.currentTime = q * video.duration; } draw(); });
$('#scrub').addEventListener('input', (e) => { seek(+e.target.value / 1000); syncKeyButtons(); draw(); });

/* ---- keys ---- */
function keyButtons() {
	const host = $('#keys'); host.innerHTML = '';
	state.keys.forEach((k, i) => { const b = document.createElement('button'); b.className = 'key' + (i === keyIndex && atKey() ? ' on' : ''); b.textContent = k.f.toFixed(3); b.addEventListener('click', () => { keyIndex = i; seek(k.f); sel = -1; syncKeyButtons(); draw(); }); host.appendChild(b); });
}
function syncKeyButtons() {
	const i = state.keys.findIndex((k) => Math.abs(k.f - f) < 1e-6); if (i >= 0) keyIndex = i;
	[...$('#keys').children].forEach((b, j) => b.classList.toggle('on', j === keyIndex && atKey()));
	$('#sel').textContent = sel >= 0 && chain !== 'tent' ? `${chain} #${sel}` : chain === 'tent' ? 'tent' : 'none';
	if (sel >= 0 && chain !== 'tent' && atKey()) $('#alpha').value = (state.keys[keyIndex].alpha?.[chain] ?? ROUTE.chains[chain].alpha)[sel] ?? 1;
}
$('#addKey').addEventListener('click', () => {
	if (state.keys.some((k) => Math.abs(k.f - f) < 1e-6)) return toast('a key is already here');
	const k = { f: +f.toFixed(4), ridge: pointsAt('ridge', f).map((p) => [+p[0].toFixed(1), +p[1].toFixed(1)]), camp: pointsAt('camp', f).map((p) => [+p[0].toFixed(1), +p[1].toFixed(1)]), tent: interpTent(f).map((v) => +v.toFixed(1)) };
	state.keys.push(k); state.keys.sort((a, b) => a.f - b.f); keyIndex = state.keys.indexOf(k);
	save(); pushKeys(); keyButtons(); syncKeyButtons(); draw(); toast(`key at ${k.f}`);
});
$('#delKey').addEventListener('click', () => {
	if (!atKey() || state.keys.length <= 2) return;
	state.keys.splice(keyIndex, 1); keyIndex = Math.max(0, keyIndex - 1); seek(state.keys[keyIndex].f);
	save(); pushKeys(); keyButtons(); syncKeyButtons(); draw();
});

/* ---- chain / point tools ---- */
for (const b of document.querySelectorAll('[data-chain]')) b.addEventListener('click', () => { chain = b.dataset.chain; sel = -1; document.querySelectorAll('[data-chain]').forEach((x) => x.classList.toggle('on', x === b)); syncKeyButtons(); draw(); });
function setAlpha(v) {
	if (sel < 0 || chain === 'tent' || !atKey()) return;
	for (const k of (allKeys ? state.keys : [state.keys[keyIndex]])) {
		k.alpha = k.alpha || {}; k.alpha[chain] = k.alpha[chain] || [...ROUTE.chains[chain].alpha];
		k.alpha[chain][sel] = Math.min(1, Math.max(0, v));
	}
	save(); pushKeys(); draw();
}
/* move the selected point by a film-space delta: on every key, or on this one */
function movePoint(dx, dy) {
	for (const k of (allKeys ? state.keys : [state.keys[keyIndex]])) {
		const p = chain === 'tent' ? k.tent : k[chain][sel];
		p[0] = +(p[0] + dx).toFixed(2); p[1] = +(p[1] + dy).toFixed(2);
	}
}
$('#modeAll').addEventListener('click', () => setMode(true));
$('#modeOne').addEventListener('click', () => setMode(false));
function setMode(all) { allKeys = all; $('#modeAll').classList.toggle('on', all); $('#modeOne').classList.toggle('on', !all); toast(all ? 'edits go to every key' : 'edits stay on this key'); }
$('#copyAll').addEventListener('click', () => {
	if (!atKey()) return toast('go to a key first');
	const src = state.keys[keyIndex];
	for (const k of state.keys) { if (k === src) continue; k.ridge = src.ridge.map((p) => [...p]); k.camp = src.camp.map((p) => [...p]); k.tent = [...src.tent]; k.alpha = src.alpha ? JSON.parse(JSON.stringify(src.alpha)) : undefined; }
	save(); pushKeys(); draw(); toast(`key ${src.f} laid on every key`);
});
$('#alpha').addEventListener('change', (e) => setAlpha(+e.target.value));
$('#hide').addEventListener('click', () => { const cur = (state.keys[keyIndex].alpha?.[chain] ?? ROUTE.chains[chain].alpha)[sel]; setAlpha(cur > 0.01 ? 0 : 1); syncKeyButtons(); });
$('#delPt').addEventListener('click', deletePoint);
function deletePoint() {
	if (sel < 0 || chain === 'tent') return;
	if (state.keys[0][chain].length <= 3) return toast('a chain keeps at least 3 points');
	for (const k of state.keys) { k[chain].splice(sel, 1); if (k.alpha?.[chain]) k.alpha[chain].splice(sel, 1); }
	// the chain's default alphas live in the config; a shorter chain needs its own
	for (const k of state.keys) { k.alpha = k.alpha || {}; if (!k.alpha[chain]) k.alpha[chain] = ROUTE.chains[chain].alpha.filter((_, i) => i !== sel); }
	sel = -1; save(); pushKeys(); draw(); syncKeyButtons();
}
function insertPoint(after, at) {
	// into every key: at the given film point on this key, at the midpoint of its neighbours elsewhere
	state.keys.forEach((k, ki) => {
		const a = k[chain][after], b = k[chain][after + 1];
		const p = ki === keyIndex && at ? at : [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
		k[chain].splice(after + 1, 0, [+p[0].toFixed(1), +p[1].toFixed(1)]);
		k.alpha = k.alpha || {}; const al = k.alpha[chain] || [...ROUTE.chains[chain].alpha]; al.splice(after + 1, 0, Math.min(al[after], al[after + 1] ?? al[after])); k.alpha[chain] = al;
	});
	sel = after + 1; save(); pushKeys(); draw(); syncKeyButtons();
}

/* ---- mouse ---- */
let drag = null;
function hit(px, py) {
	if (chain === 'tent') { const [tx, ty] = toPx(state.keys[keyIndex].tent); return Math.hypot(px - tx, py - ty) < 14 ? 0 : -1; }
	const pts = state.keys[keyIndex][chain]; let best = -1, bd = 12;
	pts.forEach((p, i) => { const [x, y] = toPx(p); const d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = i; } });
	return best;
}
const local = (e) => { const r = edit.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
edit.addEventListener('pointerdown', (e) => {
	if (!atKey()) { const k = state.keys[keyIndex]; seek(k.f); toast('snapped to the key — edit at a key'); return; }
	const i = hit(...local(e));
	if (i < 0) { sel = -1; syncKeyButtons(); draw(); return; }
	sel = i; drag = { i, last: toFilm(...local(e)) }; try { edit.setPointerCapture(e.pointerId); } catch {} syncKeyButtons(); draw();
});
edit.addEventListener('pointermove', (e) => {
	if (!drag) return;
	const now = toFilm(...local(e));
	movePoint(now[0] - drag.last[0], now[1] - drag.last[1]);   // the same delta lands on every key, or on this one
	drag.last = now;
	pushKeys(); draw();
});
edit.addEventListener('pointerup', () => { if (drag) { drag = null; save(); } });
edit.addEventListener('dblclick', (e) => {
	if (chain === 'tent' || !atKey()) return;
	// the nearest segment of the current chain
	const [mx, my] = local(e);
	const pts = state.keys[keyIndex][chain]; let best = -1, bd = 18;
	for (let i = 0; i < pts.length - 1; i++) {
		const [ax, ay] = toPx(pts[i]), [bx, by] = toPx(pts[i + 1]);
		const l2 = (bx - ax) ** 2 + (by - ay) ** 2, t = Math.max(0, Math.min(1, ((mx - ax) * (bx - ax) + (my - ay) * (by - ay)) / (l2 || 1)));
		const d = Math.hypot(mx - (ax + t * (bx - ax)), my - (ay + t * (by - ay)));
		if (d < bd) { bd = d; best = i; }
	}
	if (best >= 0) insertPoint(best, toFilm(mx, my));
});

/* ---- keyboard ---- */
document.addEventListener('keydown', (e) => {
	if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
	const step = e.shiftKey ? 1 : 0.2;
	if (e.key === 'ArrowLeft' && sel < 0) { keyIndex = Math.max(0, keyIndex - 1); seek(state.keys[keyIndex].f); }
	else if (e.key === 'ArrowRight' && sel < 0) { keyIndex = Math.min(state.keys.length - 1, keyIndex + 1); seek(state.keys[keyIndex].f); }
	else if (e.key === '[') seek(f - 1 / 240);
	else if (e.key === ']') seek(f + 1 / 240);
	else if (e.key.toLowerCase() === 's') { let bi = 0, bd = 9; state.keys.forEach((k, i) => { if (Math.abs(k.f - f) < bd) { bd = Math.abs(k.f - f); bi = i; } }); keyIndex = bi; seek(state.keys[bi].f); }
	else if (e.key.toLowerCase() === 'h') { $('#hide').click(); }
	else if (e.key.toLowerCase() === 'a') { setMode(!allKeys); }
	else if ((e.key === 'Backspace' || e.key === 'Delete') && sel >= 0) { e.preventDefault(); deletePoint(); }
	else if (sel >= 0 && atKey() && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
		e.preventDefault();
		const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
		movePoint(d[0], d[1]); save(); pushKeys();
	} else return;
	syncKeyButtons(); draw();
});

/* ---- view / export ---- */
$('#onion').addEventListener('click', (e) => { onion = !onion; e.target.classList.toggle('on', onion); draw(); });
$('#grid').addEventListener('click', (e) => { showGrid = !showGrid; e.target.classList.toggle('on', showGrid); draw(); });
$('#render').addEventListener('click', (e) => { const on = $('#route').style.display !== 'none'; $('#route').style.display = on ? 'none' : ''; e.target.classList.toggle('on', !on); });
function exportText() {
	const fmt = (p) => `[${p.map((v) => (Number.isInteger(v) ? v : +v.toFixed(1))).join(', ')}]`;
	const rows = state.keys.map((k) => {
		const a = k.alpha ? `,  alpha: ${JSON.stringify(k.alpha).replace(/"/g, '')}` : '';
		return `\t\t{ f: ${k.f.toFixed(3)}, ridge: [${k.ridge.map(fmt).join(', ')}],  camp: [${k.camp.map(fmt).join(', ')}]${a} },`;
	});
	const glow = state.keys.map((k) => `[${k.f.toFixed(3)}, ${fmt(k.tent)}]`).join(', ');
	return `\t// route-editor export ${new Date().toISOString().slice(0, 16)}\n\tkeys: [\n${rows.join('\n')}\n\t],\n\n\t// glow.keys:\n\t\tkeys: [${glow}],\n`;
}
$('#export').addEventListener('click', () => { const t = $('#exportBox'); t.value = exportText(); t.classList.toggle('on'); });
$('#copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(exportText()); toast('keys copied'); } catch { $('#exportBox').value = exportText(); $('#exportBox').classList.add('on'); toast('select and copy'); } });
$('#reset').addEventListener('click', () => { if (!confirm('Back to src/route-config.js? Your edits here are dropped.')) return; state = fromConfig(); keyIndex = 0; sel = -1; save(); pushKeys(); seek(state.keys[0].f); keyButtons(); syncKeyButtons(); draw(); });
let toastT = 0;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1400); }

/* ---- go ---- */
window.__editor = { get state() { return state; }, get box() { return box; }, get f() { return f; }, get keyIndex() { return keyIndex; }, hit: (x, y) => hit(x, y) };
function start() { measure(); layer.resize(); pushKeys(); keyButtons(); seek(state.keys[0].f); syncKeyButtons(); draw(); }
if (video.readyState >= 1) start(); else video.addEventListener('loadedmetadata', start, { once: true });
window.addEventListener('resize', () => { measure(); layer.resize(); draw(); });
