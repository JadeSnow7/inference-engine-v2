import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createJSONStorage } from 'zustand/middleware'
import { apiFetch, ApiError } from '../client'
import { useUserStore } from '../../store/user'

describe('apiFetch auth handling', () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
      removeItem: (key: string) => { values.delete(key) },
    }
    vi.stubGlobal('localStorage', storage)
    useUserStore.persist.setOptions({ storage: createJSONStorage(() => storage) })
    useUserStore.setState({ token: 'token-1', userId: 'u-1' })
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: '/' },
    })
  })

  afterEach(() => {
    useUserStore.setState({ token: null, userId: null })
    vi.restoreAllMocks()
  })

  it('logs out and redirects for AUTH_TOKEN_EXPIRED envelope error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: false,
      error: { code: 'AUTH_TOKEN_EXPIRED', message: '登录状态已过期，请重新登录' },
    }), { status: 401, headers: { 'Content-Type': 'application/json' } })))

    await expect(apiFetch('/api/profile/me')).rejects.toBeInstanceOf(ApiError)
    expect(useUserStore.getState().token).toBeNull()
    expect(window.location.href).toBe('/login')
  })
})
