/**
 * 生成 macOS 菜单栏用的 template 图标
 *
 * macOS 菜单栏图标是「单色 + alpha」：系统只取 alpha 通道，
 * 再按菜单栏明暗自动反色。所以不能直接复用 Windows 的彩色磁贴，
 * 必须画一张纯黑 + alpha 的模板图。
 *
 * 命名带 Template 后缀，Electron / macOS 会自动识别为模板图；
 * 同时提供 @2x 供 Retina 屏使用。
 *
 * 两张图都在 16×16 的逻辑网格上设计，@2x 直接按 2 倍整数放大，
 * 保证两种分辨率下都是像素对齐的硬边——降采样会把影线糊成半透明。
 *
 * 输出：build/trayTemplate.png（16×16）、build/trayTemplate@2x.png（32×32）
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { encodePng } from './png-tool.mjs'

const root = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)))
const outDir = path.join(root, 'build')
mkdirSync(outDir, { recursive: true })

/** 16×16 逻辑网格上的三根蜡烛，左低右高 */
const CANDLES = [
  { x: 2, bodyTop: 9, bodyBottom: 13, wickTop: 7, wickBottom: 15 },
  { x: 7, bodyTop: 6, bodyBottom: 10, wickTop: 4, wickBottom: 12 },
  { x: 12, bodyTop: 3, bodyBottom: 7, wickTop: 1, wickBottom: 9 },
]

const BODY_WIDTH = 3

function render(scale) {
  const size = 16 * scale
  const rgba = Buffer.alloc(size * size * 4)

  const rect = (x, y, w, h) => {
    for (let py = y * scale; py < (y + h) * scale; py++) {
      for (let px = x * scale; px < (x + w) * scale; px++) {
        if (px < 0 || py < 0 || px >= size || py >= size) continue
        const i = (py * size + px) * 4
        rgba[i] = 0
        rgba[i + 1] = 0
        rgba[i + 2] = 0
        rgba[i + 3] = 255
      }
    }
  }

  // 先画影线（1px 居中），再画实体，保证实体盖住影线中段
  for (const c of CANDLES) {
    rect(c.x + 1, c.wickTop, 1, c.wickBottom - c.wickTop)
  }
  for (const c of CANDLES) {
    rect(c.x, c.bodyTop, BODY_WIDTH, c.bodyBottom - c.bodyTop)
  }

  return { size, rgba }
}

const at1x = render(1)
const at2x = render(2)

writeFileSync(path.join(outDir, 'trayTemplate.png'), encodePng(at1x.size, at1x.size, at1x.rgba))
writeFileSync(path.join(outDir, 'trayTemplate@2x.png'), encodePng(at2x.size, at2x.size, at2x.rgba))
console.log('wrote build/trayTemplate.png (16×16) 与 build/trayTemplate@2x.png (32×32)')
