const BASE_URL = import.meta.env.VITE_API_BASE ?? ''

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = localStorage.getItem('edu_token')
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  })

  if (res.status === 401) {
    localStorage.removeItem('edu_token')
    localStorage.removeItem('edu_user')
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`)
    let detail = text
    try { detail = JSON.parse(text)?.detail ?? text } catch { /* ignore */ }
    throw new Error(detail)
  }

  return res.json() as Promise<T>
}
