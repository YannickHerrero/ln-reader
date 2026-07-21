import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import { BASE_URL } from './parsers'
import type { BrowserResponse, SourceHttpClient } from './types'

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
const MIN_REQUEST_INTERVAL_MS = 700

interface FetchResult {
  status: number
  contentType: string
  base64: string
}

export class SourceBrowserSession implements SourceHttpClient {
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private page: Page | null = null
  private startPromise: Promise<void> | null = null
  private queue: Promise<unknown> = Promise.resolve()
  private nextRequestAt = 0

  request(
    path: string,
    options: { method?: 'GET' | 'POST'; headers?: Record<string, string>; body?: string } = {},
  ): Promise<BrowserResponse> {
    const operation = this.queue.then(() => this.performRequest(path, options))
    this.queue = operation.catch(() => undefined)
    return operation
  }

  async close(): Promise<void> {
    await this.browser?.close()
    this.browser = null
    this.context = null
    this.page = null
    this.startPromise = null
  }

  private async performRequest(
    path: string,
    options: { method?: 'GET' | 'POST'; headers?: Record<string, string>; body?: string },
  ): Promise<BrowserResponse> {
    await this.ensureStarted()
    await this.pace()
    let result = await this.fetchInPage(path, options)
    if (result.status === 403 || result.status === 503) {
      await this.restart()
      await this.ensureStarted()
      await this.pace()
      result = await this.fetchInPage(path, options)
    }
    return {
      status: result.status,
      contentType: result.contentType,
      body: Buffer.from(result.base64, 'base64'),
    }
  }

  private async fetchInPage(
    path: string,
    options: { method?: 'GET' | 'POST'; headers?: Record<string, string>; body?: string },
  ): Promise<FetchResult> {
    if (!this.page) throw new Error('Source browser is not ready.')
    const url = new URL(path, BASE_URL)
    if (url.origin !== BASE_URL) throw new Error('Cross-origin source request rejected.')

    return this.page.evaluate(async ({ target, requestOptions }) => {
      const response = await fetch(target, {
        method: requestOptions.method ?? 'GET',
        headers: requestOptions.headers,
        body: requestOptions.body,
        credentials: 'include',
      })
      const bytes = new Uint8Array(await response.arrayBuffer())
      let binary = ''
      const chunkSize = 32_768
      for (let index = 0; index < bytes.length; index += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
      }
      return {
        status: response.status,
        contentType: response.headers.get('content-type') ?? 'application/octet-stream',
        base64: btoa(binary),
      }
    }, { target: url.toString(), requestOptions: options })
  }

  private async ensureStarted(): Promise<void> {
    if (this.page) return
    if (!this.startPromise) this.startPromise = this.start()
    await this.startPromise
  }

  private async start(): Promise<void> {
    const executablePath = process.env.CHROME_EXECUTABLE_PATH || undefined
    this.browser = await chromium.launch({
      headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
      executablePath,
      args: ['--disable-blink-features=AutomationControlled'],
    })
    this.context = await this.browser.newContext({
      userAgent: USER_AGENT,
      locale: 'fr-FR',
      timezoneId: 'Europe/Paris',
    })
    this.page = await this.context.newPage()
    await this.page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 })

    const deadline = Date.now() + 60_000
    while (Date.now() < deadline) {
      const title = await this.page.title()
      if (!/just a moment|un instant/i.test(title)) return
      await this.page.waitForTimeout(1_500)
    }
    throw new Error('Cloudflare clearance timed out.')
  }

  private async restart(): Promise<void> {
    await this.close()
  }

  private async pace(): Promise<void> {
    const delay = Math.max(0, this.nextRequestAt - Date.now())
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay))
    this.nextRequestAt = Date.now() + MIN_REQUEST_INTERVAL_MS
  }
}
