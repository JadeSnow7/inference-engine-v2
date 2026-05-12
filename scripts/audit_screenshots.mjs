import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const appUrl = process.env.AUDIT_APP_URL ?? 'http://127.0.0.1:5174'
const chromePath = resolveChromePath()
const outDir = process.env.AUDIT_SCREENSHOT_DIR ?? 'audit-artifacts/screenshots'
const debugPort = Number(process.env.AUDIT_CHROME_PORT ?? 9223)

function resolveChromePath() {
  const candidates = [
    process.env.CHROME_BIN,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/opt/homebrew/bin/chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter(Boolean)
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue
    const probe = spawnSync(candidate, ['--version'], { stdio: 'ignore' })
    if (probe.status === 0) return candidate
  }
  throw new Error(
    `No working Chrome/Chromium binary found. Tried: ${candidates.join(', ')}. ` +
    `Install Google Chrome or set CHROME_BIN to an executable browser.`,
  )
}

const viewports = [
  { name: 'desktop', width: 1440, height: 1000, mobile: false },
  { name: 'tablet', width: 768, height: 1024, mobile: false },
  { name: 'mobile', width: 390, height: 844, mobile: true },
]

const pages = [
  { name: 'login', path: '/login', auth: false },
  { name: 'dashboard', path: '/', auth: true },
  { name: 'courses', path: '/courses', auth: true },
  { name: 'workbench', path: '/workbench', auth: true },
  { name: 'library', path: '/library', auth: true },
  { name: 'graph', path: '/graph', auth: true },
  { name: 'writing', path: '/writing', auth: true },
]

await mkdir(outDir, { recursive: true })

console.log(`[audit] chrome: ${chromePath}`)
console.log(`[audit] app:    ${appUrl}`)
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=/tmp/scholar-audit-chrome-${Date.now()}`,
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  'about:blank',
], { stdio: ['ignore', 'ignore', 'inherit'] })
chrome.on('exit', (code, signal) => {
  if (code !== 0 && code !== null) {
    console.error(`[audit] chrome exited early: code=${code} signal=${signal}`)
  }
})

try {
  await waitForChrome()
  const targets = await fetchJson(`http://127.0.0.1:${debugPort}/json/list`)
  const target = targets.find(item => item.type === 'page')
  if (!target?.webSocketDebuggerUrl) throw new Error('No Chrome page target available')

  const client = await connectCdp(target.webSocketDebuggerUrl)
  await client.send('Page.enable')
  await client.send('Runtime.enable')

  for (const viewport of viewports) {
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: viewport.mobile,
    })

    for (const page of pages) {
      await navigate(client, `${appUrl}/login`)
      await client.send('Runtime.evaluate', {
        expression: page.auth ? authScript() : 'localStorage.clear(); sessionStorage.clear();',
      })
      await navigate(client, `${appUrl}${page.path}`)
      await waitForRender(client, 15000)
      const result = await client.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false,
      })
      const file = join(outDir, `${viewport.name}-${page.name}.png`)
      await writeFile(file, Buffer.from(result.data, 'base64'))
      console.log(file)
    }
  }

  client.close()
} finally {
  chrome.kill('SIGTERM')
}

function authScript() {
  const persisted = {
    state: {
      token: 'audit-token',
      userId: 'audit@hust.edu.cn',
      profile: {
        teachingStyle: 'step_by_step',
        feedbackVerbosity: 'balanced',
        writingStage: '正在写第一篇',
        hasCompletedOnboarding: true,
      },
      profileStatus: 'loaded',
      profileError: '',
    },
    version: 0,
  }
  return `
    localStorage.setItem('edu_token', 'audit-token');
    localStorage.setItem('edu_user', ${JSON.stringify(JSON.stringify(persisted))});
    sessionStorage.clear();
  `
}

async function waitForChrome() {
  const endpoint = `http://127.0.0.1:${debugPort}/json/version`
  for (let i = 0; i < 50; i += 1) {
    try {
      await fetchJson(endpoint)
      return
    } catch {
      await delay(100)
    }
  }
  throw new Error('Chrome did not start')
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status} ${url}`)
  return response.json()
}

async function navigate(client, url) {
  const loaded = client.waitFor('Page.loadEventFired')
  await client.send('Page.navigate', { url })
  await loaded
}

async function waitForRender(client, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const probe = await client.send('Runtime.evaluate', {
      expression: '(() => { const r = document.getElementById("root"); return r ? r.innerText.length + "|" + r.children.length : "0|0"; })()',
      returnByValue: true,
    })
    const [textLen, childCount] = String(probe.result?.value ?? '0|0').split('|').map(Number)
    if (textLen > 20 || childCount > 0) {
      await delay(400)
      return
    }
    await delay(200)
  }
  console.warn(`[audit] waitForRender timed out after ${timeoutMs}ms`)
}

function connectCdp(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    let id = 0
    const pending = new Map()
    const listeners = new Map()

    ws.addEventListener('open', () => {
      resolve({
        send(method, params = {}) {
          id += 1
          ws.send(JSON.stringify({ id, method, params }))
          return new Promise((res, rej) => pending.set(id, { res, rej }))
        },
        waitFor(method) {
          return new Promise(res => listeners.set(method, res))
        },
        close() {
          ws.close()
        },
      })
    })
    ws.addEventListener('error', reject)
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)
      if (message.id && pending.has(message.id)) {
        const { res, rej } = pending.get(message.id)
        pending.delete(message.id)
        if (message.error) rej(new Error(message.error.message))
        else res(message.result ?? {})
        return
      }
      const listener = listeners.get(message.method)
      if (listener) {
        listeners.delete(message.method)
        listener(message.params ?? {})
      }
    })
  })
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
