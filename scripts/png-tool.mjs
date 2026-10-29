// 极简 PNG 解码/编码工具（仅依赖 node:zlib），用于裁切设计稿并采样颜色
import { inflateSync, deflateSync } from 'node:zlib'
import { readFileSync, writeFileSync } from 'node:fs'

export function decodePng(buf) {
  let pos = 8
  let width = 0
  let height = 0
  let bitDepth = 8
  let colorType = 6
  const idat = []
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString('ascii', pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') break
    pos += 12 + len
  }
  if (bitDepth !== 8) throw new Error('only 8-bit png supported, got ' + bitDepth)
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : null
  if (!channels) throw new Error('unsupported colorType ' + colorType)

  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const out = Buffer.alloc(width * height * 4)
  let prev = Buffer.alloc(stride)
  let p = 0
  for (let y = 0; y < height; y++) {
    const filter = raw[p++]
    const line = Buffer.from(raw.subarray(p, p + stride))
    p += stride
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? line[x - channels] : 0
      const b = prev[x]
      const c = x >= channels ? prev[x - channels] : 0
      let v = line[x]
      if (filter === 1) v += a
      else if (filter === 2) v += b
      else if (filter === 3) v += (a + b) >> 1
      else if (filter === 4) {
        const pa = Math.abs(b - c)
        const pb = Math.abs(a - c)
        const pc = Math.abs(a + b - 2 * c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      line[x] = v & 0xff
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4
      if (channels === 4) {
        out[o] = line[x * 4]
        out[o + 1] = line[x * 4 + 1]
        out[o + 2] = line[x * 4 + 2]
        out[o + 3] = line[x * 4 + 3]
      } else if (channels === 3) {
        out[o] = line[x * 3]
        out[o + 1] = line[x * 3 + 1]
        out[o + 2] = line[x * 3 + 2]
        out[o + 3] = 255
      } else {
        out[o] = out[o + 1] = out[o + 2] = line[x]
        out[o + 3] = 255
      }
    }
    prev = line
  }
  return { width, height, data: out }
}

const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

export function encodePng(width, height, rgba) {
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

export function crop(img, x0, y0, w, h, scale = 1) {
  const out = Buffer.alloc(w * scale * h * scale * 4)
  for (let y = 0; y < h * scale; y++) {
    for (let x = 0; x < w * scale; x++) {
      const sx = Math.min(img.width - 1, x0 + Math.floor(x / scale))
      const sy = Math.min(img.height - 1, y0 + Math.floor(y / scale))
      const si = (sy * img.width + sx) * 4
      const di = (y * (w * scale) + x) * 4
      out[di] = img.data[si]
      out[di + 1] = img.data[si + 1]
      out[di + 2] = img.data[si + 2]
      out[di + 3] = img.data[si + 3]
    }
  }
  return { width: w * scale, height: h * scale, data: out }
}

export function sample(img, x, y) {
  const i = (y * img.width + x) * 4
  return '#' + [img.data[i], img.data[i + 1], img.data[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')
}

const [, , cmd, ...rest] = process.argv
if (cmd === 'crop') {
  const [src, x, y, w, h, scale, out] = rest
  const img = decodePng(readFileSync(src))
  const c = crop(img, +x, +y, +w, +h, +(scale || 1))
  writeFileSync(out, encodePng(c.width, c.height, c.data))
  console.log('wrote', out, c.width + 'x' + c.height)
} else if (cmd === 'size') {
  const img = decodePng(readFileSync(rest[0]))
  console.log(img.width + 'x' + img.height)
} else if (cmd === 'pick') {
  const img = decodePng(readFileSync(rest[0]))
  for (let i = 1; i < rest.length; i++) {
    const [x, y] = rest[i].split(',').map(Number)
    console.log(rest[i], sample(img, x, y))
  }
}
