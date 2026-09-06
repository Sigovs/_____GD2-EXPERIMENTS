// Собирает публикуемое дерево _____GD2-EXPERIMENTS из рабочего каталога GD 2 AAN.
//
// Правило структуры: папка на лабораторию, ПОДПАПКА НА КАЖДУЮ ВЕРСИЮ.
// Версия становится <лаб>/<slug>/index.html. Ассеты НЕ дублируются в каждую
// подпапку — они лежат один раз на уровне лаборатории, а ссылки в странице
// сдвигаются на один уровень вверх. Дублирование assets20 одиннадцать раз
// стоило бы 385 МБ вместо 35 МБ и ничего бы не дало.
//
// Источник описаний — tools/versions.json рабочего каталога. Ни одна строка
// карточки здесь не пишется по памяти.

import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, rmSync, readdirSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

const SRC = 'c:/____WORK/_____GD 2 AAN'
const OUT = 'c:/____WORK/_____GD2-EXPERIMENTS'

const cat = JSON.parse(readFileSync(join(SRC, 'tools/versions.json'), 'utf8'))

// ── карта: группа → папка лаборатории, её общие ассеты, и slug каждой версии ──
const LABS = {
  root:  { dir: '',             assets: [] },
  test1: { dir: 'aan test 1',   assets: [] },                    // фаза 2 — сборка Vite
  test2: { dir: 'aan test 2',   assets: ['assets'], extra: ['CONCEPT.md'] },
  test3: { dir: 'aan test 3',   assets: [] },                    // скаффолд копируется как есть
  test4: { dir: 'aan test 4',   assets: ['assets20', 'assets9', 'docs'],
           files: ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png'] },
  test5: { dir: 'aan test 5',   assets: ['assets', '3d models'] },
  test6: { dir: 'aan test 6',   assets: [] },                    // фаза 2 — зеркало Astro
}

// slug подпапки = имя файла без расширения
const slugFor = e => e.group === 'test3' ? 'GD_LAB_TEST'
  : e.file ? e.file.split('/').pop().replace(/[.]html$/, '')
  : e.slug.replace(/^t[0-9]+-/, '')

// ── переписывание путей: страница уходит на один уровень глубже ───────────────
// Трогаем только document-relative ссылки. Абсолютные, протокольные, якоря и
// data: остаются нетронутыми — якорь, превращённый в ../#foo, ломает skip-link.
const SKIP = /^(https?:|\/\/|\/|#|data:|mailto:|tel:|javascript:|\.\.\/)/i

function deeper (url) {
  if (!url || SKIP.test(url)) return url
  return '../' + url.replace(/^\.\//, '')
}

function rewrite (html, siblingMap) {
  // 1. атрибуты src/href/poster/data-src/content=url
  html = html.replace(/\b(src|href|poster|data-src)=("|')([^"']*)\2/gi,
    (m, attr, q, url) => {
      // ссылка на соседнюю версию того же лаба → её новая подпапка
      const sib = siblingMap[url]
      if (sib) return `${attr}=${q}../${sib}/${q}`
      return `${attr}=${q}${deeper(url)}${q}`
    })
  // 2. srcset — список "url 1x, url 2x"
  html = html.replace(/\bsrcset=("|')([^"']*)\1/gi, (m, q, list) =>
    `srcset=${q}${list.split(',').map(p => {
      const t = p.trim().split(/\s+/)
      t[0] = deeper(t[0]); return t.join(' ')
    }).join(', ')}${q}`)
  // 3. url(...) в инлайновом CSS
  html = html.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi,
    (m, q, url) => `url(${q}${deeper(url)}${q})`)
  // 4. динамический import('./…') в инлайновых модулях
  html = html.replace(/import\(\s*(["'])\.\/([^"']+)\1\s*\)/g,
    (m, q, path) => `import(${q}../${path}${q})`)
  return html
}

// ── подписи «как открывается» — те же формулировки, что на текущем шелфе ──────
const OPENS = {
  'file':        ['opens from disk',  'Double-click it. No server, no network.'],
  'server':      ['needs a server',   'Blocked on a file:// origin — start the server named below.'],
  'file-online': ['needs the network','Opens from disk, but fetches from a CDN.'],
  'none':        ['not runnable',     'Kept as a record. It cannot be served as it stands.'],
}

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const enc = p => p.split('/').map(encodeURIComponent).join('/')

function card (e, scope, previewPrefix) {
  const lab = LABS[e.group]
  const href = enc(scope === 'lab' ? slugFor(e)
    : [lab.dir, slugFor(e)].filter(Boolean).join('/'))
  const [label, title] = OPENS[e.opens] || OPENS.none
  const shot = existsSync(join(OUT, 'previews', e.slug + '.jpg')) ? e.slug + '.jpg'
             : existsSync(join(OUT, 'previews', e.slug + '.jpeg')) ? e.slug + '.jpeg' : null
  const cls = 'card' + (e.rejected ? ' card--rejected' : '') + (e.broken ? ' card--broken' : '')
  return `      <li>
        <a class="${cls}" href="${href}/">
          <div class="card__shot${shot ? '' : ' card__shot--none'}">${
            shot ? `<img src="${previewPrefix}previews/${shot}" alt="" width="1440" height="900" loading="lazy" decoding="async">`
                 : '<span class="card__shot__none">no preview</span>'}</div>
          <p class="card__name">${esc(e.name)}</p>
          <p class="card__what">${esc(e.what)}</p>
          <p class="card__settles">${esc(e.settles)}</p>${
          e.note ? `\n          <p class="card__note">${esc(e.note)}</p>` : ''}
          <p class="card__opens" title="${esc(title)}">${label}</p>
        </a>
      </li>`
}

export { cat, LABS, slugFor, rewrite, card, esc, enc, SRC, OUT }

// ─────────────────────────────────────────────────────────────────────────────
// СБОРКА
// ─────────────────────────────────────────────────────────────────────────────

const copy = (from, to) => {
  const s = join(SRC, from), d = join(OUT, to)
  if (!existsSync(s)) { console.warn('  ! нет:', from); return }
  mkdirSync(dirname(d), { recursive: true })
  // Вложенный .git внутрь этого репозитория не едет: он сделал бы подмодуль
  // там, где нужен просто каталог файлов.
  cpSync(s, d, { recursive: true, filter: src => basename(src) !== '.git' })
}

const write = (rel, text) => {
  const d = join(OUT, rel)
  mkdirSync(dirname(d), { recursive: true })
  writeFileSync(d, text)
}

// Стиль шелфа берётся из существующей страницы, а не переписывается заново.
const rootPage = readFileSync(join(SRC, 'index.html'), 'utf8')
const shelfStyle = (rootPage.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1]

console.log('· превью')
copy('previews', 'previews')
// Превью лабораторий не дублируются: корневой previews/ уже держит все тридцать,
// назван по slug каталога, и обе полки — корневая и лабораторная — берут их оттуда.

console.log('· общий слой шелфа')
copy('aan test 4/assets20/css/tokens.css', '_shelf/tokens.css')
copy('aan test 4/assets20/css/hub.css', '_shelf/hub.css')

console.log('· ассеты лабораторий')
for (const [id, lab] of Object.entries(LABS)) {
  for (const a of lab.assets || []) copy(`${lab.dir}/${a}`, `${lab.dir}/${a}`)
  for (const f of lab.files || []) copy(`${lab.dir}/${f}`, `${lab.dir}/${f}`)
  for (const f of lab.extra || []) copy(`${lab.dir}/${f}`, `${lab.dir}/${f}`)
}

console.log('· версии → подпапки')
const byGroup = {}
for (const e of cat.entries) (byGroup[e.group] ||= []).push(e)

let made = 0, skipped = []
for (const [gid, entries] of Object.entries(byGroup)) {
  const lab = LABS[gid]
  // карта «старое имя файла → новый slug» для перелинковки внутри лаборатории
  const siblings = {}
  for (const e of entries) if (e.file) siblings[e.file.split('/').pop()] = slugFor(e)

  for (const e of entries) {
    if (!e.file) { skipped.push(e.slug); continue }
    if (e.group === 'test3') { skipped.push(e.slug + ' (скаффолд копируется как есть)'); continue }
    const src = join(SRC, e.file)
    if (!existsSync(src)) { skipped.push(e.slug + ' (нет файла)'); continue }
    const depth = e.file.split('/').length - (lab.dir ? 1 : 0) - 1  // proto/hero-proof.html
    let html = readFileSync(src, 'utf8')
    if (depth > 0) {
      // страница уже лежала глубже — её пути были относительны своей папке;
      // в новой раскладке она поднимается прямо под лабораторию, так что
      // сдвиг тот же самый: один уровень.
    }
    html = rewrite(html, siblings)
    write(join(lab.dir, slugFor(e), 'index.html'), html)
    made++
  }
}
console.log(`  ${made} версий разложено, пропущено: ${skipped.join(', ') || '—'}`)

console.log('· aan test 3 — скаффолд как есть')
copy('aan test 3/GD_LAB_TEST', 'aan test 3/GD_LAB_TEST')

// ── хабы ─────────────────────────────────────────────────────────────────────
function hub ({ title, eyebrow, h1, lede, groups, depth }) {
  const up = '../'.repeat(depth)
  return `<!doctype html>
<html lang="en">
<head>
<!-- Собрано tools/build.mjs из tools/versions.json. Руками не править:
     следующая сборка перезапишет. Что версия ЕСТЬ и что она РЕШАЕТ —
     перенесено из документа, который уже существовал; versions.json
     называет источник каждой строки. -->
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="theme-color" content="#0B0F1E">
<link rel="stylesheet" href="${up}_shelf/tokens.css">
<link rel="stylesheet" href="${up}_shelf/hub.css">
<style>${shelfStyle}</style>
</head>
<body>

<main class="wrap">

  <p class="hub__eyebrow">${esc(eyebrow)}</p>
  <h1 class="hub__h">${h1}</h1>
${lede}

${groups}

  <p class="hub__foot"><span class="hub__stamp">tools/versions.json · ${
    new Date().toISOString().slice(0, 10)}</span></p>

</main>
</body>
</html>
`
}

console.log('· хаб каждой лаборатории')
for (const g of cat.groups) {
  if (g.id === 'root') continue
  const lab = LABS[g.id], entries = byGroup[g.id] || []
  const cards = entries.map(e => card(e, 'lab', '../')).join('\n')
  write(join(lab.dir, 'index.html'), hub({
    depth: 1,
    title: `${lab.dir} — every version`,
    eyebrow: lab.dir,
    h1: `${entries.length} ${entries.length === 1 ? 'version' : 'versions'} in this folder.`,
    lede: `  <p class="hub__lede">${esc(g.blurb)}</p>\n  <p class="hub__lede">Each card opens one version. <a href="../">All six labs</a>.</p>`,
    groups: `  <section class="grp">\n    <ul class="shelf">\n${cards}\n    </ul>\n  </section>`,
  }))
}

console.log('· корневой хаб')
const rootGroups = cat.groups.map(g => {
  const entries = byGroup[g.id] || []
  const head = g.id === 'root' ? '' :
    `    <p class="grp__blurb">${esc(g.blurb)} <a href="${enc(LABS[g.id].dir)}/">Открыть лабораторию →</a></p>\n`
  return `  <section class="grp">
    <h2 class="grp__h">${esc(g.title)}</h2>
${head}    <ul class="shelf">
${entries.map(e => card(e, 'root', '')).join('\n')}
    </ul>
  </section>`
}).join('\n\n')

write('index.html', hub({
  depth: 0,
  title: 'GD 2 AAN — every version',
  eyebrow: 'GD 2 AAN — every version',
  h1: `${cat.groups.length} labs, ${cat.entries.length} versions, one shelf.`,
  lede: `  <p class="hub__lede">Nothing in this tree was deleted, so every version any of these
    labs produced can still be opened and judged against the ones beside it.
    <b>This page is the only index of them.</b></p>
  <p class="hub__lede">Every lab is a folder and <b>every version is a folder inside it</b>.
    Each card says what the version <b>is</b> and what it was built to
    <b>settle</b> — both lifted from a document that already existed.
    <code>tools/versions.json</code> names the source for every line.</p>`,
  groups: rootGroups,
}))

write('.nojekyll', '')
console.log('готово')

// ─────────────────────────────────────────────────────────────────────────────
// aan test 1 — девять версий одного Vite-приложения
//
// Девять «версий» здесь не девять файлов, а один вход, который читает
// query-параметр. Собирать его девять раз — значит девять раз положить одни и
// те же 95 МБ моделей. Поэтому: одна сборка в _app/, и подпапка на версию, в
// которой лежит страница, уводящая на свой параметр. Правило «подпапка на
// каждую версию» держится, URL у каждой версии свой.
// ─────────────────────────────────────────────────────────────────────────────

const T1_DIST = join(SRC, 'aan test 1/dist')

if (existsSync(T1_DIST)) {
  console.log('· aan test 1 — сборка Vite → _app/')
  const app = join(OUT, 'aan test 1/_app')
  rmSync(app, { recursive: true, force: true })
  cpSync(T1_DIST, app, { recursive: true })

  // Пути к моделям, облакам, шрифтам и видео в исходниках корневые ('/models/…').
  // На Pages корень — не эта папка. Строковые литералы Vite не трогает, поэтому
  // ведущий слэш снимается здесь — но только там, где сразу за кавычкой, чтобы
  // не задеть текст ошибок вида «exists in public/models/».
  const fixDir = join(app, 'assets')
  let touched = 0
  for (const f of readdirSync(fixDir).filter(n => n.endsWith('.js'))) {
    const p = join(fixDir, f)
    const before = readFileSync(p, 'utf8')
    const after = before.replace(/(["'`])\/(models|clouds|fonts|video|textures|images)\//g, '$1./$2/')
    if (after !== before) { writeFileSync(p, after); touched++ }
  }
  console.log(`  корневые пути сняты в ${touched} чанках`)

  for (const e of byGroup.test1 || []) {
    const slug = e.slug.replace(/^t1-/, '')
    const param = e.name.startsWith('?') ? e.name : ''
    const target = '../_app/' + param
    write(join('aan test 1', slug, 'index.html'), `<!doctype html>
<meta charset="utf-8">
<title>${esc(e.name)} — aan test 1</title>
<!-- Одна сборка приложения обслуживает все девять режимов; режим выбирается
     параметром. Эта страница — адрес версии, а не её копия. -->
<meta http-equiv="refresh" content="0; url=${esc(target)}">
<link rel="canonical" href="${esc(target)}">
<body style="background:#0B0F1E;color:#8a93a5;font:14px/1.6 ui-monospace,monospace;padding:3rem">
<p>${esc(e.name)} → <a href="${esc(target)}" style="color:#7dd3fc">../_app/${esc(param)}</a></p>
`)
  }
  console.log(`  ${(byGroup.test1 || []).length} версий адресовано`)
} else {
  console.warn('  ! нет aan test 1/dist — запустите: cd "aan test 1" && npx vite build --base ./')
}

// ─────────────────────────────────────────────────────────────────────────────
// aan test 6 — зеркало Montfort
//
// Не публикуется, и по двум независимым причинам.
//   1. Технически: зеркало обязано лежать в корне сервера — все его пути
//      корневые ('/_astro/…'). В подпапке репозитория оно не резолвится, а
//      переписывать 33 страницы значит перестать быть зеркалом 1:1.
//   2. По существу: это полная копия чужого коммерческого сайта. Держать её
//      локально для разбора — одно, выложить публично — другое.
// Папка версии всё равно есть: запись о версии остаётся на полке.
// ─────────────────────────────────────────────────────────────────────────────

console.log('· aan test 6 — карточки-записи без зеркала')
for (const e of byGroup.test6 || []) {
  const slug = e.slug.replace(/^t6-/, '')
  const shot = existsSync(join(OUT, 'previews', e.slug + '.jpeg')) ? e.slug + '.jpeg' : null
  write(join('aan test 6', slug, 'index.html'), `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(e.name)} — aan test 6</title>
<link rel="stylesheet" href="../../_shelf/tokens.css">
<link rel="stylesheet" href="../../_shelf/hub.css">
<style>${shelfStyle}</style>
</head>
<body>
<main class="wrap">
  <p class="hub__eyebrow">aan test 6 — Montfort mirror</p>
  <h1 class="hub__h">${esc(e.name)}</h1>
  <p class="hub__lede">${esc(e.what)}</p>
  <p class="hub__lede"><b>Что решает.</b> ${esc(e.settles)}</p>
  ${shot ? `<p><img src="../../previews/${shot}" alt="" style="max-width:100%;border:1px solid var(--rule)"></p>` : ''}
  <p class="hub__lede">Версия живёт только в рабочем каталоге и здесь не выложена:
    зеркало держит корневые пути и работает лишь в корне сервера, а сверх того
    это полная копия чужого сайта. Запуск — <code>START.bat</code> в
    <code>aan test 6</code>, порт ${esc(e.url || '')}.</p>
  <p class="hub__foot"><a href="../">← aan test 6</a> · <a href="../../">все лаборатории</a></p>
</main>
</body>
</html>
`)
}
console.log('готово (второй проход)')
