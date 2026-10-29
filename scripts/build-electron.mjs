import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)))

export async function buildElectron({ watch = false } = {}) {
  const common = {
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    sourcemap: watch ? 'inline' : false,
    minify: !watch,
    logLevel: 'info',
    // 原生/带动态 require 的依赖交给运行时从 node_modules 解析
    external: ['electron', 'electron-store', 'conf'],
    alias: {
      '@': path.join(root, 'src'),
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(watch ? 'development' : 'production'),
    },
  }

  await build({
    ...common,
    entryPoints: [path.join(root, 'electron/main.ts')],
    outfile: path.join(root, 'dist-electron/main.js'),
  })

  await build({
    ...common,
    entryPoints: [path.join(root, 'electron/preload.ts')],
    outfile: path.join(root, 'dist-electron/preload.js'),
  })
}

if (process.argv[1] && process.argv[1].endsWith('build-electron.mjs')) {
  await buildElectron()
}
