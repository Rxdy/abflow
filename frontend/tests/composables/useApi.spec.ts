import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { useAuth } from '../../src/composables/useAuth'
import { useApi } from '../../src/composables/useApi'
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

function setup() {
  let auth!: ReturnType<typeof useAuth>
  let api!: ReturnType<typeof useApi>
  const { router } = setupWithRouter(() => {
    auth = useAuth()
    api = useApi()
    return null
  })
  return { auth, api, router }
}

describe('useApi', () => {
  it('getImages requests the right URL with auth headers and returns parsed JSON', async () => {
    const { auth, api } = setup()
    auth.logout()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'tok_1' }) })
    await auth.login('admin', 'secret')

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ total: 0, limit: 50, offset: 0, images: [] }),
    })

    const result = await api.getImages(50, 0, 'image')

    const [url, opts] = fetchMock.mock.calls[1]
    expect(url).toBe('/api/images?limit=50&offset=0&type=image')
    expect(opts.headers.Authorization).toBe('Bearer tok_1')
    expect(result).toEqual({ total: 0, limit: 50, offset: 0, images: [] })
  })

  it('logs out and returns null when a request gets a 401', async () => {
    const { auth, api, router } = setup()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'tok_2' }) })
    await auth.login('admin', 'secret')

    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 })
    const stats = await api.getStats()
    await flushPromises()

    expect(stats).toBeNull()
    expect(auth.token.value).toBeNull()
    expect(router.currentRoute.value.name).toBe('login')
  })

  it('uploadImage throws the server error message on failure', async () => {
    const { auth, api } = setup()
    auth.logout()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'tok_3' }) })
    await auth.login('admin', 'secret')

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 413,
      json: async () => ({ error: 'Quota dépassé (max 2000 Mo)' }),
    })

    await expect(api.uploadImage(new File(['x'], 'photo.jpg'))).rejects.toThrow('Quota dépassé (max 2000 Mo)')
  })

  it('getStats returns the parsed stats including quotaBytes', async () => {
    const { auth, api } = setup()
    auth.logout()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'tok_4' }) })
    await auth.login('admin', 'secret')

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ count: 3, totalSize: 1024, byType: { image: 3 }, quotaBytes: 2_000_000_000 }),
    })

    const stats = await api.getStats()
    expect(stats).toEqual({ count: 3, totalSize: 1024, byType: { image: 3 }, quotaBytes: 2_000_000_000 })
  })
})
