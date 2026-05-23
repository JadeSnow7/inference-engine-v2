import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const appUrl = process.env.AUDIT_APP_URL ?? 'http://127.0.0.1:5174'
const outDir = process.env.AUDIT_SCREENSHOT_DIR ?? '/private/tmp/thesis-case-shots'
const debugPort = Number(process.env.AUDIT_CHROME_PORT ?? 9224)
const chromePath = resolveChromePath()

const cases = [
  {
    name: 'fig-case-citation-feedback',
    waitingName: 'fig-case-citation-waiting',
    mode: 'citation',
    text: 'GraphRAG has been widely used in knowledge-intensive generation tasks (Smith, 2023), and it can improve the reliability of retrieval-augmented generation.',
    response: {
      nodes: [
        { id: 'citation_in_text_format', label: '文内引用格式', type: 'citation', score: 0.94 },
        { id: 'reference_list_consistency', label: '参考文献一致性', type: 'citation', score: 0.91 },
        { id: 'evidence_support_requirement', label: '证据支撑要求', type: 'evidence', score: 0.88 },
      ],
      expanded_context: [
        {
          id: 'citation-context',
          title: '引用格式与文末条目一致',
          excerpt: '文内引用应能在参考文献列表中找到完整对应条目。',
          score: 0.9,
        },
      ],
      validation: [
        { id: 'citation-format', status: 'warning', message: '当前句子使用 Smith, 2023，但需要核对引用格式和文末条目。' },
        { id: 'claim-evidence', status: 'warning', message: 'widely used 与 improve reliability 属于较强概括，应补充证据或弱化表述。' },
      ],
      references: [
        { id: 'citation_in_text_format', title: 'citation_in_text_format', source: 'Academic writing KG', year: 2026 },
        { id: 'reference_list_consistency', title: 'reference_list_consistency', source: 'Academic writing KG', year: 2026 },
      ],
    },
  },
  {
    name: 'fig-case-experiment-feedback',
    mode: 'structure',
    text: 'This system uses GraphRAG to improve academic writing feedback. The system includes a knowledge graph, a retrieval module, and a feedback generation module. We tested the system and obtained good results.',
    response: {
      nodes: [
        { id: 'experiment_goal_statement', label: '实验目标说明', type: 'structure', score: 0.93 },
        { id: 'baseline_comparison_requirement', label: '对照方法要求', type: 'experiment', score: 0.89 },
        { id: 'metric_supported_claim', label: '指标支撑要求', type: 'evidence', score: 0.87 },
        { id: 'claim_boundary_control', label: '结论边界控制', type: 'argument', score: 0.92 },
      ],
      expanded_context: [
        {
          id: 'experiment-context',
          title: '实验章节需要说明目标、指标与边界',
          excerpt: '系统测试结果应区分流程验证、集成证据和教学效果结论。',
          score: 0.91,
        },
      ],
      validation: [
        { id: 'goal', status: 'warning', message: '段落说明了系统组成，但没有明确实验目标。' },
        { id: 'metric', status: 'warning', message: 'good results 缺少指标支撑，不宜直接作为性能结论。' },
        { id: 'boundary', status: 'warning', message: '应区分 pipeline validation、live smoke test 与教学效果证明。' },
      ],
      references: [
        { id: 'experiment_goal_statement', title: 'experiment_goal_statement', source: 'Academic writing KG', year: 2026 },
        { id: 'claim_boundary_control', title: 'claim_boundary_control', source: 'Academic writing KG', year: 2026 },
      ],
    },
  },
]

await mkdir(outDir, { recursive: true })
console.log(`[case] chrome: ${chromePath}`)
console.log(`[case] app:    ${appUrl}`)
console.log(`[case] out:    ${outDir}`)

const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=/tmp/scholar-case-chrome-${Date.now()}`,
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  'about:blank',
], { stdio: ['ignore', 'ignore', 'inherit'] })

try {
  await waitForChrome()
  const targets = await fetchJson(`http://127.0.0.1:${debugPort}/json/list`)
  const target = targets.find(item => item.type === 'page')
  if (!target?.webSocketDebuggerUrl) throw new Error('No Chrome page target available')

  const client = await connectCdp(target.webSocketDebuggerUrl)
  await client.send('Page.enable')
  await client.send('Runtime.enable')
  await client.send('Fetch.enable', {
    patterns: [
      { urlPattern: '*://*/v1/writing/analyze*', requestStage: 'Request' },
      { urlPattern: '*://*/api/profile/me*', requestStage: 'Request' },
    ],
  })

  let activeCase = cases[0]
  client.on('Fetch.requestPaused', async event => {
    const url = event.request?.url ?? ''
    if (url.includes('/v1/writing/analyze')) {
      await client.send('Fetch.fulfillRequest', {
        requestId: event.requestId,
        responseCode: 200,
        responseHeaders: [{ name: 'content-type', value: 'application/json' }],
        body: Buffer.from(JSON.stringify({ ok: true, data: activeCase.response })).toString('base64'),
      })
      return
    }
    if (url.includes('/api/profile/me')) {
      await client.send('Fetch.fulfillRequest', {
        requestId: event.requestId,
        responseCode: 200,
        responseHeaders: [{ name: 'content-type', value: 'application/json' }],
        body: Buffer.from(JSON.stringify({
          ok: true,
          data: {
            teaching_style: 'step_by_step',
            feedback_verbosity: 'balanced',
            writing_stage: '正在写第一篇',
            major: 'computer science',
            weak_points: {},
            total_sessions: 0,
            last_session_at: 0,
          },
        })).toString('base64'),
      })
      return
    }
    await client.send('Fetch.continueRequest', { requestId: event.requestId })
  })

  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1180,
    deviceScaleFactor: 1,
    mobile: false,
  })

  for (const item of cases) {
    activeCase = item
    await navigate(client, `${appUrl}/login`)
    await client.send('Runtime.evaluate', {
      expression: authScript(),
      returnByValue: true,
    })
    await navigate(client, `${appUrl}/writing`)
    await waitForRender(client, 15000)
    await setWritingTextAndMode(client, item.text, item.mode)
    await waitForText(client, '等待分析', 10000)
    if (item.waitingName) {
      await delay(500)
      const waiting = await client.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false,
      })
      const waitingFile = join(outDir, `${item.waitingName}.png`)
      await writeFile(waitingFile, Buffer.from(waiting.data, 'base64'))
      console.log(waitingFile)
    }
    await clickAnalyze(client)
    await waitForText(client, '规范节点', 10000)
    await waitForText(client, item.response.nodes[0].label, 10000)
    await delay(500)
    const result = await client.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    })
    const file = join(outDir, `${item.name}.png`)
    await writeFile(file, Buffer.from(result.data, 'base64'))
    console.log(file)
  }

  client.close()
} finally {
  chrome.kill('SIGTERM')
}

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
  throw new Error(`No working Chrome/Chromium binary found. Tried: ${candidates.join(', ')}`)
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

async function setWritingTextAndMode(client, text, mode) {
  await client.send('Runtime.evaluate', {
    expression: `(() => {
      const tab = Array.from(document.querySelectorAll('button')).find(button => button.textContent?.includes(${JSON.stringify(modeLabel(mode))}));
      tab?.click();
      const textarea = document.querySelector('#writing-analysis-text');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(textarea, ${JSON.stringify(text)});
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    })()`,
    returnByValue: true,
  })
}

async function clickAnalyze(client) {
  await client.send('Runtime.evaluate', {
    expression: `(() => {
      const button = Array.from(document.querySelectorAll('button')).find(item => item.textContent?.includes('分析学术规范'));
      button?.click();
    })()`,
    returnByValue: true,
  })
}

function modeLabel(mode) {
  if (mode === 'citation') return '引文核查'
  if (mode === 'structure') return '结构建议'
  return '规范校验'
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
  throw new Error(`waitForRender timed out after ${timeoutMs}ms`)
}

async function waitForText(client, text, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const probe = await client.send('Runtime.evaluate', {
      expression: `document.body.innerText.includes(${JSON.stringify(text)})`,
      returnByValue: true,
    })
    if (probe.result?.value === true) return
    await delay(200)
  }
  throw new Error(`Timed out waiting for text: ${text}`)
}

function connectCdp(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    let id = 0
    const pending = new Map()
    const listeners = new Map()
    const eventHandlers = new Map()

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
        on(method, handler) {
          eventHandlers.set(method, handler)
        },
        close() {
          ws.close()
        },
      })
    })
    ws.addEventListener('error', reject)
    ws.addEventListener('message', async event => {
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
      const handler = eventHandlers.get(message.method)
      if (handler) {
        try {
          await handler(message.params ?? {})
        } catch (error) {
          console.error(`[case] handler failed for ${message.method}:`, error)
        }
      }
    })
  })
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
