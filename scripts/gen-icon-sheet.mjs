// 生成图标对照页（亮 / 暗两套），用于目检全部 SVG
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const dir = path.resolve('src/assets/icons')
const files = readdirSync(dir).filter((f) => f.endsWith('.svg')).sort()

const order = [
  'market-bottom',
  'market-down',
  'market-rebound',
  'market-bull',
  'short-term',
  'long-term',
  'dividend',
  'trend-up',
  'trend-down',
  'stock-detail',
  'favorite',
  'add',
  'remove',
  'close',
  'collapse',
  'search',
  'refresh',
  'settings',
  'pin',
]

const cells = order
  .filter((name) => files.includes(`${name}.svg`))
  .map((name) => {
    const svg = readFileSync(path.join(dir, `${name}.svg`), 'utf8')
      .replace('width="64" height="64"', 'width="72" height="72"')
    return `<div class="cell">${svg}<span>${name}</span></div>`
  })
  .join('')

writeFileSync(
  '.tmp/icons-sheet.html',
  `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;font:11px 'Segoe UI',sans-serif;background:#f2f6fb;padding:12px}
  .grid{display:flex;flex-wrap:wrap;gap:2px}
  .cell{width:88px;display:flex;flex-direction:column;align-items:center;gap:3px;padding:4px}
  .cell span{color:#7b8794;font-size:10px}
  .dark{background:#131c29;border-radius:14px;padding:8px;margin-top:10px}
  .dark .cell span{color:#93a3b6}
  .dark .cell svg{color:#e8eef6}
  </style></head><body>
  <div class="grid">${cells}</div>
  <div class="grid dark">${cells}</div>
  </body></html>`,
)
console.log('sheet written', files.length, 'icons')
