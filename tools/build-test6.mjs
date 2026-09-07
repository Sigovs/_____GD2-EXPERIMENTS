// Полка aan test 6 — из хаба рабочего каталога, а не из versions.json.
//
// В aan test 6 уже есть своя страница версий, собранная его собственным
// build-hub.mjs из variant.json каждого варианта. Она свежее, чем versions.json
// (там вариант всё ещё «Проба пера — palette work», а в variant.json он давно
// «Версия 2 — Guidance Development 2»), и она — запись, которую вёл Алекс.
// Поэтому берётся она, а не генерится своя.
//
// Меняется ровно то, что перестаёт быть правдой при публикации: адреса
// localhost, скрипт опроса портов и строки про START.bat.

import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const SRC = 'c:/____WORK/_____GD 2 AAN/aan test 6'
const OUT = 'c:/____WORK/_____GD2-EXPERIMENTS/aan test 6'

console.log('· aan test 6 — полка из рабочего хаба')

// Превью для карточек этой полки лежат рядом с хабом и названы по варианту,
// а не по slug каталога, поэтому корневой previews/ их не заменяет.
if (existsSync(join(SRC, 'previews'))) {
  mkdirSync(OUT, { recursive: true })
  cpSync(join(SRC, 'previews'), join(OUT, 'previews'), { recursive: true })
}

let html = readFileSync(join(SRC, 'index.html'), 'utf8')

// Оригинал не выложен — карточка ведёт на запись о версии, а не в пустоту.
html = html.replace('href="http://localhost:4321/" target="_blank" data-port="4321"',
                    'href="original/"')
html = html.replace('href="http://localhost:4322/" target="_blank" data-port="4322"',
                    'href="proba/"')

// Точка статуса опрашивала локальные порты. Опубликованной странице опрашивать
// нечего, а серый кружок без объяснения читается как поломка.
html = html.replace(/\s*<span class="dot"[^>]*><\/span>/g, '')
html = html.replace(/<script>[\s\S]*?<\/script>\s*<\/body>/, '</body>')

// Подзаголовок и подписи карточек говорили про локальный запуск.
html = html.replace(
  /<p class="sub">[\s\S]*?<\/p>/,
  '<p class="sub">Вариант открывается по ссылке. Оригинальное зеркало не выложено — ' +
  'оно держит корневые пути и работает только в корне сервера, и это полная копия ' +
  'чужого сайта; карточка ведёт на запись о нём.</p>')
html = html.replace('<code>localhost:4321</code>', '<code>не выложен</code>')
html = html.replace('<code>localhost:4322</code>', '<code>proba/</code>')

// Подвал описывал работу в каталоге, а не эту страницу.
html = html.replace(/<footer>[\s\S]*?<\/footer>/,
  '<footer>\n  <p>Собрано из <code>aan test 6/index.html</code> рабочего каталога. ' +
  'Вариант материализован целиком: на статике оверлей поверх зеркала не работает, ' +
  'сервера, который подставлял бы изменённые файлы, здесь нет.</p>\n</footer>')

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'index.html'), html)
console.log('  index.html полки переписан под публикацию')
