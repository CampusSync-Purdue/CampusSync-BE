import type { AddressInfo } from 'node:net'
import app from '../app.js'

export type JsonResponse<T = Record<string, unknown>> = {
  status: number
  body: T
  rawBody: string
}

/** Starts the app on a random port for integration tests. */
export async function startTestServer() {
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const listening = app.listen(0, () => resolve(listening))
  })

  const { port } = server.address() as AddressInfo
  const baseUrl = `http://127.0.0.1:${port}`

  async function request<T = Record<string, unknown>>(
    method: string,
    path: string,
    options: { body?: unknown; token?: string } = {},
  ): Promise<JsonResponse<T>> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }

    if (options.token) {
      headers.Authorization = `Bearer ${options.token}`
    }

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })

    const rawBody = await response.text()

    return {
      status: response.status,
      body: (rawBody ? JSON.parse(rawBody) : {}) as T,
      rawBody,
    }
  }

  async function close(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  }

  return { baseUrl, request, close }
}
