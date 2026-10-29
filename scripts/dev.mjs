import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createServer } from 'vite'
import { buildElectron } from './build-electron.mjs'

const require = createRequire(import.meta.url)
const root = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)))

const server = await createServer({ root })
await server.listen()
server.printUrls()

const url = server.resolvedUrls?.local?.[0] ?? `http://localhost:${server.config.server.port}/`
console.log(`\n[market-pulse] dev server: ${url}`)

await buildElectron({ watch: true })

const electronPath = require('electron')
const child = spawn(electronPath, ['.'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_SERVER_URL: url },
})

const shutdown = async () => {
  try {
    await server.close()
  } catch {
    /* noop */
  }
  process.exit(0)
}

child.on('close', shutdown)
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
