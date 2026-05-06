import { useUserStore } from '../store/user'

const BASE_URL = import.meta.env.VITE_API_BASE ?? ''

export class ApiError extends Error {
  code: string
  status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = useUserStore.getState().token

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers ?? {}),
      },
    })
  } catch {
    throw new ApiError('NETWORK_ERROR', '网络连接失败，请检查网络', 0)
  }

  // 尝试解析 JSON 信封
  const body = await res.json().catch(() => null)

  // 后端信封错误（ok === false）
  if (body?.ok === false) {
    const code = body.error?.code ?? 'UNKNOWN'
    const message = body.error?.message ?? `请求失败`
    if (res.status === 401 || code.startsWith('AUTH_')) {
      useUserStore.getState().logout()
      window.location.href = '/login'
    }
    throw new ApiError(code, message, res.status)
  }

  // HTTP 层错误（无法解析 JSON 或 ok 字段缺失）
  if (!res.ok) {
    const message = body?.error?.message ?? `HTTP ${res.status}`
    const code = body?.error?.code ?? 'HTTP_ERROR'
    if (res.status === 401) {
      useUserStore.getState().logout()
      window.location.href = '/login'
    }
    throw new ApiError(code, message, res.status)
  }

  return body.data as T
}
