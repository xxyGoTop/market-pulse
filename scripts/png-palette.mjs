// 统计区域内的高饱和颜色簇，用于从设计稿里提取真实配色
import { readFileSync } from 'node:fs'
import { decodePng } from './png-tool.mjs'

const [, , src, xs, ys, ws, hs, minSat = '0.28', minLight = '0.25'] = process.argv
const img = decodePng(readFileSync(src))
const x0 = +xs
const y0 = +ys
const w = +ws
const h = +hs

function rgb2hsl(r, g, b) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let hh
  if (max === r) hh = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) hh = ((b - r) / d + 2) / 6
  else hh = ((r - g) / d + 4) / 6
  return [hh * 360, s, l]
}

const buckets = new Map()
for (let y = y0; y < y0 + h; y++) {
  for (let x = x0; x < x0 + w; x++) {
    const i = (y * img.width + x) * 4
    const r = img.data[i]
    const g = img.data[i + 1]
    const b = img.data[i + 2]
    const [hh, s, l] = rgb2hsl(r, g, b)
    if (s < +minSat || l < +minLight) continue
    const key = Math.round(hh / 10) * 10
    let e = buckets.get(key)
    if (!e) buckets.set(key, (e = { n: 0, r: 0, g: 0, b: 0, s: 0, pts: [] }))
    e.n++
    e.r += r
    e.g += g
    e.b += b
    e.s += s
    if (e.pts.length < 400) e.pts.push([x, y])
  }
}

const rows = [...buckets.entries()]
  .filter(([, e]) => e.n > 40)
  .sort((a, b) => b[1].n - a[1].n)
  .slice(0, 14)

for (const [hue, e] of rows) {
  const hex = (v) => Math.round(v / e.n).toString(16).padStart(2, '0')
  console.log(
    `hue~${hue}  n=${e.n}  #${hex(e.r)}${hex(e.g)}${hex(e.b)}  sat=${(e.s / e.n).toFixed(2)}  e.g. (${e.pts[0][0]},${e.pts[0][1]})`,
  )
}
