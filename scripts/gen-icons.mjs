/**
 * 生成 Market Pulse 桌面应用图标（1024×1024）与托盘图标。
 *
 * 设计：深蓝底圆角方块 + 薄荷绿柱状图与上涨箭头，不含文字，缩小后仍可辨识。
 * 纯手写 PNG 编码 + 距离场抗锯齿，不引入图形库。
 *
 * 用法：node scripts/gen-icons.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import path from 'node:path'

/* ----------------------------- PNG 编码 ----------------------------- */

const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(width, height, rgba) {
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/* ----------------------------- 绘图基元 ----------------------------- */

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

/** 圆角矩形覆盖率（SDF，带 1px 抗锯齿） */
function roundRectCov(px, py, x, y, w, h, r) {
  const cx = x + w / 2
  const cy = y + h / 2
  const dx = Math.abs(px - cx) - (w / 2 - r)
  const dy = Math.abs(py - cy) - (h / 2 - r)
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0))
  const inside = Math.min(Math.max(dx, dy), 0)
  return clamp01(0.5 - (outside + inside - r))
}

/** 圆头线段覆盖率 */
function segCov(px, py, ax, ay, bx, by, width) {
  const vx = bx - ax
  const vy = by - ay
  const wx = px - ax
  const wy = py - ay
  const len2 = vx * vx + vy * vy
  const t = len2 === 0 ? 0 : clamp01((wx * vx + wy * vy) / len2)
  const d = Math.hypot(px - (ax + vx * t), py - (ay + vy * t))
  return clamp01(width / 2 - d + 0.5)
}

const mix = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]

/* ------------------------------ 绘制 ------------------------------ */

const NAVY_FROM = [0x22, 0x33, 0x47]
const NAVY_TO = [0x13, 0x1c, 0x29]
const MINT = [0x5f, 0xe3, 0xb0]

function drawAppIcon(size, { light = false } = {}) {
  const ss = 3
  const pad = size * 0.055
  const tile = size - pad * 2
  const radius = tile * 0.235
  const out = Buffer.alloc(size * size * 4)

  // 柱状图（底部对齐）
  const baseY = 0.79
  const bars = [
    { x: 0.235, w: 0.086, top: 0.655 },
    { x: 0.373, w: 0.086, top: 0.575 },
    { x: 0.511, w: 0.086, top: 0.495 },
  ]
  const strokeW = 0.05

  // 上涨折线 + 拐角箭头（整体位于柱状图上方，避免粘连）
  const line = [
    [0.245, 0.628],
    [0.392, 0.452],
    [0.503, 0.508],
    [0.748, 0.248],
  ]
  const arrow = [
    [0.748, 0.248],
    [0.66, 0.248],
  ]
  const arrow2 = [
    [0.748, 0.248],
    [0.748, 0.336],
  ]

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let tileCov = 0
      let glyphCov = 0
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const px = x + (sx + 0.5) / ss
          const py = y + (sy + 0.5) / ss
          tileCov += roundRectCov(px, py, pad, pad, tile, tile, radius)

          const nx = (px - pad) / tile
          const ny = (py - pad) / tile
          let g = 0
          for (const bar of bars) {
            g = Math.max(
              g,
              roundRectCov(
                nx * tile,
                ny * tile,
                bar.x * tile,
                bar.top * tile,
                bar.w * tile,
                (baseY - bar.top) * tile,
                bar.w * tile * 0.42,
              ),
            )
          }
          for (let i = 0; i < line.length - 1; i++) {
            g = Math.max(
              g,
              segCov(
                nx * tile,
                ny * tile,
                line[i][0] * tile,
                line[i][1] * tile,
                line[i + 1][0] * tile,
                line[i + 1][1] * tile,
                strokeW * tile,
              ),
            )
          }
          for (const a of [arrow, arrow2]) {
            g = Math.max(
              g,
              segCov(
                nx * tile,
                ny * tile,
                a[0][0] * tile,
                a[0][1] * tile,
                a[1][0] * tile,
                a[1][1] * tile,
                strokeW * tile,
              ),
            )
          }
          glyphCov += g
        }
      }
      tileCov /= ss * ss
      glyphCov = Math.min(1, glyphCov / (ss * ss))

      const t = clamp01((x * 0.55 + y * 0.45) / size)
      const bgFrom = light ? [0xf2, 0xf6, 0xfb] : NAVY_FROM
      const bgTo = light ? [0xdd, 0xe6, 0xf2] : NAVY_TO
      const bg = mix(bgFrom, bgTo, t)
      const mint = light ? [0x18, 0xb0, 0x7e] : MINT
      const color = mix(bg, mint, glyphCov)

      const i = (y * size + x) * 4
      out[i] = Math.round(color[0])
      out[i + 1] = Math.round(color[1])
      out[i + 2] = Math.round(color[2])
      out[i + 3] = Math.round(tileCov * 255)
    }
  }
  return encodePng(size, size, out)
}

const buildDir = path.resolve('build')
const tauriDir = path.resolve('src-tauri/icons')
mkdirSync(buildDir, { recursive: true })
mkdirSync(tauriDir, { recursive: true })

// 主图：1024 母版
const master = drawAppIcon(1024)
writeFileSync(path.join(tauriDir, 'app-icon.png'), master)
writeFileSync(path.join(buildDir, 'icon.png'), master)

// 托盘：文件名 = 它适用的任务栏明暗
//   浅色任务栏 → 深色磁贴（tray-light.png）
//   深色任务栏 → 浅色磁贴（tray-dark.png）
writeFileSync(path.join(buildDir, 'tray-light.png'), drawAppIcon(64))
writeFileSync(path.join(buildDir, 'tray-dark.png'), drawAppIcon(64, { light: true }))
writeFileSync(path.join(buildDir, 'tray.png'), drawAppIcon(64))

console.log('app icon -> src-tauri/icons/app-icon.png, build/icon.png')
console.log('tray icons -> build/tray-light.png（浅色任务栏）, build/tray-dark.png（深色任务栏）')
