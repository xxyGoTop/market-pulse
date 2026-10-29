/**
 * 由 1024×1024 主图派生出各平台图标：
 * - Windows  .ico（多尺寸，内嵌 PNG）
 * - macOS    .icns（ic07 ~ ic14）
 * - 通用     icon-<size>.png（32 / 64 / 128 / 256 / 512 / 1024）
 * - 托盘     tray-dark.png / tray-light.png / tray.png（64）
 *
 * 纯 Node 实现（zlib + 手写 ICO/ICNS 容器），不依赖 tauri CLI 或图形库，
 * 保证在离线环境下也能复现。
 *
 * 用法：node scripts/gen-platform-icons.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { decodePng, encodePng } from './png-tool.mjs'

const SRC = path.resolve('src-tauri/icons/app-icon.png')
const OUT = path.resolve('src-tauri/icons')
const BUILD = path.resolve('build')

/** 盒式滤波缩放，避免缩小时出现锯齿与振铃 */
function resize(img, size) {
  const out = Buffer.alloc(size * size * 4)
  const ratio = img.width / size
  for (let y = 0; y < size; y++) {
    const y0 = Math.floor(y * ratio)
    const y1 = Math.min(img.height, Math.ceil((y + 1) * ratio))
    for (let x = 0; x < size; x++) {
      const x0 = Math.floor(x * ratio)
      const x1 = Math.min(img.width, Math.ceil((x + 1) * ratio))
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let n = 0
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * img.width + sx) * 4
          const alpha = img.data[i + 3]
          // 预乘 alpha 再平均，避免透明边缘发黑
          r += img.data[i] * alpha
          g += img.data[i + 1] * alpha
          b += img.data[i + 2] * alpha
          a += alpha
          n++
        }
      }
      const o = (y * size + x) * 4
      if (a > 0) {
        out[o] = Math.round(r / a)
        out[o + 1] = Math.round(g / a)
        out[o + 2] = Math.round(b / a)
      }
      out[o + 3] = Math.round(a / n)
    }
  }
  return { width: size, height: size, data: out }
}

function pngOf(img, size) {
  const r = resize(img, size)
  return encodePng(size, size, r.data)
}

/* ------------------------------- ICO ------------------------------- */

function buildIco(entries) {
  const count = entries.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(count, 4)

  const dir = Buffer.alloc(16 * count)
  let offset = 6 + 16 * count
  entries.forEach((entry, i) => {
    const base = i * 16
    // 256 在 ICO 目录里用 0 表示
    dir[base] = entry.size >= 256 ? 0 : entry.size
    dir[base + 1] = entry.size >= 256 ? 0 : entry.size
    dir[base + 2] = 0
    dir[base + 3] = 0
    dir.writeUInt16LE(1, base + 4)
    dir.writeUInt16LE(32, base + 6)
    dir.writeUInt32LE(entry.png.length, base + 8)
    dir.writeUInt32LE(offset, base + 12)
    offset += entry.png.length
  })

  return Buffer.concat([header, dir, ...entries.map((e) => e.png)])
}

/* ------------------------------- ICNS ------------------------------ */

const ICNS_TYPES = [
  ['ic11', 32], // 16@2x
  ['ic12', 64], // 32@2x
  ['ic07', 128],
  ['ic13', 256], // 128@2x
  ['ic08', 256],
  ['ic14', 512], // 256@2x
  ['ic09', 512],
  ['ic10', 1024], // 512@2x
]

function buildIcns(img) {
  const chunks = ICNS_TYPES.map(([type, size]) => {
    const png = pngOf(img, size)
    const head = Buffer.alloc(8)
    head.write(type, 0, 'ascii')
    head.writeUInt32BE(png.length + 8, 4)
    return Buffer.concat([head, png])
  })
  const body = Buffer.concat(chunks)
  const head = Buffer.alloc(8)
  head.write('icns', 0, 'ascii')
  head.writeUInt32BE(body.length + 8, 4)
  return Buffer.concat([head, body])
}

/* ------------------------------- 执行 ------------------------------ */

const src = decodePng(readFileSync(SRC))
if (src.width !== 1024 || src.height !== 1024) {
  throw new Error(`app-icon.png 必须是 1024×1024，实际 ${src.width}×${src.height}`)
}

mkdirSync(OUT, { recursive: true })
mkdirSync(BUILD, { recursive: true })

const icoSizes = [16, 24, 32, 48, 64, 128, 256]
const icoEntries = icoSizes.map((size) => ({ size, png: pngOf(src, size) }))
writeFileSync(path.join(OUT, 'icon.ico'), buildIco(icoEntries))
writeFileSync(path.join(BUILD, 'icon.ico'), buildIco(icoEntries))

writeFileSync(path.join(OUT, 'icon.icns'), buildIcns(src))
writeFileSync(path.join(BUILD, 'icon.icns'), buildIcns(src))

for (const size of [32, 64, 128, 256, 512, 1024]) {
  const png = pngOf(src, size)
  writeFileSync(path.join(OUT, `icon-${size}.png`), png)
  if (size === 512) writeFileSync(path.join(BUILD, 'icon-512.png'), png)
}

// 托盘图标由 gen-icons.mjs 按深浅两套程序化绘制，这里不覆盖

console.log('platform icons →', OUT)
console.log('  icon.ico  sizes:', icoSizes.join(' / '))
console.log('  icon.icns sizes:', ICNS_TYPES.map(([, s]) => s).join(' / '))
