import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { useAuth } from '../../src/composables/useAuth'
import { setupWithRouter } from '../helpers/withRouter'

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('useAuth', () => {
  it('login stores the token, persists it and redirects to /files', async () => {
    const { result: auth, router } = setupWithRouter(useAuth)
    auth.logout()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'tok_123' }) })

    await auth.login('admin', 'secret')
    await router.isReady()

    expect(auth.token.value).toBe('tok_123')
    expect(localStorage.getItem('auth_token')).toBe('tok_123')
    expect(router.currentRoute.value.name).toBe('files')
  })

  it('login throws on invalid credentials and does not store a token', async () => {
    const { result: auth } = setupWithRouter(useAuth)
    auth.logout()
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Invalid credentials' }) })

    await expect(auth.login('admin', 'wrong')).rejects.toThrow('Invalid credentials')
    expect(auth.token.value).toBeNull()
    expect(localStorage.getItem('auth_token')).toBeNull()
  })

  it('logout clears the token and redirects to login with the expired flag', async () => {
    const { result: auth, router } = setupWithRouter(useAuth)
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'tok_abc' }) })
    await auth.login('admin', 'secret')

    auth.logout(true)
    await flushPromises()

    expect(auth.token.value).toBeNull()
    expect(localStorage.getItem('auth_token')).toBeNull()
    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.expired).toBe('1')
  })

  it('authHeaders is empty when logged out and includes the bearer token when logged in', async () => {
    const { result: auth } = setupWithRouter(useAuth)
    auth.logout()
    expect(auth.authHeaders()).toEqual({})

    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'tok_xyz' }) })
    await auth.login('admin', 'secret')
    expect(auth.authHeaders()).toEqual({ Authorization: 'Bearer tok_xyz' })
  })
})
