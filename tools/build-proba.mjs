// Материализует «Пробу пера» из зеркала Montfort в публикуемую папку.
//
// Вариант в рабочем каталоге — оверлей: в variants/01-proba/ лежат только
// изменённые файлы, остальное сервер берёт из site/. Статический хостинг так
// не умеет, поэтому здесь вариант собирается целиком: зеркало плюс оверлей
// поверх него.
//
// ПОЧЕМУ ПУТИ СТАНОВЯТСЯ АБСОЛЮТНЫМИ, А НЕ ОТНОСИТЕЛЬНЫМИ
//
// Зеркало держит корневые пути ('/_astro/…', '/assets/…') и рассчитано на то,
// что лежит в корне сервера. На Pages корень — корень домена, а не эта папка.
//
// Относительный путь тут не спасает: страницы лежат на разной глубине ('/',
// '/trading/', '/news/<slug>/'), а чанки _astro общие — один и тот же чанк
// грузит '/assets/models/…' с любой из них. Относительная ссылка внутри такого
// чанка резолвилась бы от адреса документа и ломалась бы везде, кроме корня.
//
// Поэтому ведущий слэш заменяется на полный путь развёртывания. Он не зависит
// от глубины страницы и одинаково верен из любого чанка. Цена — папка привязана
// к этому адресу: переименование репозитория её сломает.

import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, readdirSync, statSync } from 'node:fs'
import { join, extname, relative } from 'node:path'

const SRC = 'c:/____WORK/_____GD 2 AAN/aan test 6'
const OUT = 'c:/____WORK/_____GD2-EXPERIMENTS/aan test 6/proba'

// Адрес, по которому эта папка живёт. Единственное место, где он записан.
const PREFIX = '/_____GD2-EXPERIMENTS/aan%20test%206/proba'

// Файлы оверлея, которые описывают вариант, а не входят в него.
const OVERLAY_META = new Set(['README.txt', 'variant.json', '_check.html', '_debug.html'])

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = join(dir, e.name)
  return e.isDirectory() ? walk(p) : [p]
})

// ── 1. зеркало ───────────────────────────────────────────────────────────────
console.log('· копирую зеркало')
rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
cpSync(join(SRC, 'site'), OUT, { recursive: true })

// ── 2. оверлей поверх ────────────────────────────────────────────────────────
console.log('· кладу оверлей варианта')
const overlayRoot = join(SRC, 'variants/01-proba')
let overlaid = 0
for (const abs of walk(overlayRoot)) {
  const rel = relative(overlayRoot, abs).split('\\').join('/')
  if (OVERLAY_META.has(rel)) continue
  const dest = join(OUT, rel)
  mkdirSync(join(dest, '..'), { recursive: true })
  cpSync(abs, dest)
  overlaid++
}
console.log(`  ${overlaid} файлов варианта поверх базы`)

// ── 3. корневые пути → путь развёртывания ────────────────────────────────────
// Заменяется только ведущий слэш, за которым идёт обычный символ пути. '//'
// не трогается — это протокольно-относительный адрес чужого хоста, а не наш
// корень.
const rebase = (text) => text
  // href="/x"  src="/x"  content="/x"  data-src="/x"  poster="/x"
  .replace(/\b(href|src|poster|content|data-src|data-href)=("|')\/(?!\/)/gi,
    (m, attr, q) => `${attr}=${q}${PREFIX}/`)
  // srcset="/a 1x, /b 2x"
  .replace(/\bsrcset=("|')([^"']*)\1/gi, (m, q, list) =>
    `srcset=${q}${list.split(',').map((part) => {
      const t = part.trim().split(/\s+/)
      if (/^\/(?!\/)/.test(t[0])) t[0] = PREFIX + t[0]
      return t.join(' ')
    }).join(', ')}${q}`)
  // url(/x) в CSS и в инлайновых стилях
  .replace(/url\(\s*(["']?)\/(?!\/)/gi, (m, q) => `url(${q}${PREFIX}/`)
  // строковые литералы в чанках _astro: "/assets/…", "/_astro/…"
  .replace(/(["'`])\/(assets|_astro)\//g, (m, q, dir) => `${q}${PREFIX}/${dir}/`)

console.log('· переписываю корневые пути')
const REWRITABLE = new Set(['.html', '.htm', '.css', '.js', '.mjs'])
let files = 0, changed = 0
for (const abs of walk(OUT)) {
  if (!REWRITABLE.has(extname(abs).toLowerCase())) continue
  files++
  const before = readFileSync(abs, 'utf8')
  const after = rebase(before)
  if (after !== before) { writeFileSync(abs, after); changed++ }
}
console.log(`  ${changed} из ${files} текстовых файлов переписано`)

// ── 4. отчёт ─────────────────────────────────────────────────────────────────
let bytes = 0, count = 0
for (const abs of walk(OUT)) { bytes += statSync(abs).size; count++ }
console.log(`готово: ${count} файлов, ${(bytes / 1048576).toFixed(0)} МБ`)
