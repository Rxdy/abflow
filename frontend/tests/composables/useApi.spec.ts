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

  it('uploadImage resolves with the created file on success', async () => {
    const { auth, api } = setup()
    auth.logout()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'tok_3b' }) })
    await auth.login('admin', 'secret')

    const created = { filename: 'gen.jpg', url: '/uploads/gen.jpg', size: 10, uploadedAt: 1, fileType: 'image' }
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => created })

    await expect(api.uploadImage(new File(['x'], 'photo.jpg'))).resolves.toEqual(created)
  })

  it('renameFile patches the display name and returns it', async () => {
    const { auth, api } = setup()
    auth.logout()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'tok_3c' }) })
    await auth.login('admin', 'secret')

    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ displayName: 'Vacances' }) })
    const result = await api.renameFile('photo.jpg', 'Vacances')

    const [url, opts] = fetchMock.mock.calls[1]
    expect(url).toBe('/api/images/photo.jpg')
    expect(opts.method).toBe('PATCH')
    expect(JSON.parse(opts.body)).toEqual({ displayName: 'Vacances' })
    expect(result).toEqual({ displayName: 'Vacances' })
  })

  it('renameFile throws on failure', async () => {
    const { auth, api } = setup()
    auth.logout()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'tok_3d' }) })
    await auth.login('admin', 'secret')

    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 })
    await expect(api.renameFile('ghost.jpg', 'x')).rejects.toThrow('Erreur renommage')
  })

  it('mediaUrl appends the token as a query param so <img>/<video> tags can authenticate', async () => {
    const { auth, api } = setup()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'tok_media' }) })
    await auth.login('admin', 'secret')

    expect(api.mediaUrl('/uploads/photo.jpg')).toBe('/uploads/photo.jpg?token=tok_media')
    expect(api.mediaUrl('/uploads/photo.jpg?key=abf_x')).toBe('/uploads/photo.jpg?key=abf_x&token=tok_media')
  })

  it('mediaUrl returns the URL unchanged when logged out', async () => {
    const { auth, api } = setup()
    auth.logout()
    expect(api.mediaUrl('/uploads/photo.jpg')).toBe('/uploads/photo.jpg')
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

  it('deleteImages posts the filenames and returns deleted/errors', async () => {
    const { auth, api } = setup()
    auth.logout()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'tok_5' }) })
    await auth.login('admin', 'secret')

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ deleted: ['a.jpg'], errors: ['ghost.jpg'] }),
    })

    const result = await api.deleteImages(['a.jpg', 'ghost.jpg'])

    const [url, opts] = fetchMock.mock.calls[1]
    expect(url).toBe('/api/images')
    expect(opts.method).toBe('DELETE')
    expect(JSON.parse(opts.body)).toEqual({ filenames: ['a.jpg', 'ghost.jpg'] })
    expect(result).toEqual({ deleted: ['a.jpg'], errors: ['ghost.jpg'] })
  })

  it('deleteImages throws on failure', async () => {
    const { auth, api } = setup()
    auth.logout()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'tok_6' }) })
    await auth.login('admin', 'secret')

    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 })
    await expect(api.deleteImages(['a.jpg'])).rejects.toThrow('Erreur suppression')
  })

  it('createShareLink posts the filename and returns the share URL', async () => {
    const { auth, api } = setup()
    auth.logout()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'tok_7' }) })
    await auth.login('admin', 'secret')

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: '/share/abc', expiresAt: 123456 }),
    })

    const result = await api.createShareLink('photo.jpg')

    const [url, opts] = fetchMock.mock.calls[1]
    expect(url).toBe('/api/share')
    expect(JSON.parse(opts.body)).toEqual({ filename: 'photo.jpg' })
    expect(result).toEqual({ url: '/share/abc', expiresAt: 123456 })
  })

  it('createShareLink throws on failure', async () => {
    const { auth, api } = setup()
    auth.logout()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'tok_8' }) })
    await auth.login('admin', 'secret')

    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 })
    await expect(api.createShareLink('ghost.jpg')).rejects.toThrow('Erreur création lien')
  })

  it('downloadFile fetches the blob and triggers a browser download', async () => {
    const { auth, api } = setup()
    auth.logout()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'tok_9' }) })
    await auth.login('admin', 'secret')

    const blob = new Blob(['content'])
    fetchMock.mockResolvedValueOnce({ ok: true, blob: async () => blob })

    const createObjectURL = vi.fn(() => 'blob:mock-url')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    await api.downloadFile('photo.jpg', '/uploads/photo.jpg')

    expect(createObjectURL).toHaveBeenCalledWith(blob)
    expect(clickSpy).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')

    clickSpy.mockRestore()
  })

  it('downloadFile throws when the response is not ok', async () => {
    const { auth, api } = setup()
    auth.logout()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'tok_10' }) })
    await auth.login('admin', 'secret')

    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 })
    await expect(api.downloadFile('ghost.jpg', '/uploads/ghost.jpg')).rejects.toThrow('404')
  })

  it('uploadImageWithProgress reports progress and resolves with the uploaded file', async () => {
    const { auth, api } = setup()
    auth.logout()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'tok_11' }) })
    await auth.login('admin', 'secret')

    class FakeXHR {
      static instances: FakeXHR[] = []
      status = 0
      responseText = ''
      upload = { addEventListener: vi.fn((event: string, cb: (e: unknown) => void) => {
        if (event === 'progress') this.onProgress = cb
      }) }
      onProgress?: (e: { lengthComputable: boolean; loaded: number; total: number }) => void
      listeners: Record<string, Array<() => void>> = {}
      open = vi.fn()
      send = vi.fn()
      setRequestHeader = vi.fn()
      addEventListener(event: string, cb: () => void) {
        (this.listeners[event] ??= []).push(cb)
      }
      constructor() { FakeXHR.instances.push(this) }
    }
    vi.stubGlobal('XMLHttpRequest', FakeXHR)

    const progressUpdates: number[] = []
    const uploadPromise = api.uploadImageWithProgress(
      new File(['data'], 'photo.jpg'),
      (pct) => progressUpdates.push(pct),
    )

    const xhr = FakeXHR.instances[0]
    expect(xhr.setRequestHeader).toHaveBeenCalledWith('Authorization', 'Bearer tok_11')
    xhr.onProgress?.({ lengthComputable: true, loaded: 50, total: 100 })

    xhr.status = 201
    xhr.responseText = JSON.stringify({ filename: 'gen.jpg', url: '/uploads/gen.jpg', size: 4, uploadedAt: 1, fileType: 'image' })
    xhr.listeners['load']?.forEach(cb => cb())

    const result = await uploadPromise
    expect(progressUpdates).toEqual([50])
    expect(result.filename).toBe('gen.jpg')
  })

  it('uploadImageWithProgress rejects on a network error', async () => {
    const { auth, api } = setup()
    auth.logout()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'tok_12' }) })
    await auth.login('admin', 'secret')

    class FakeXHR {
      static instances: FakeXHR[] = []
      upload = { addEventListener: vi.fn() }
      listeners: Record<string, Array<() => void>> = {}
      open = vi.fn()
      send = vi.fn()
      setRequestHeader = vi.fn()
      addEventListener(event: string, cb: () => void) {
        (this.listeners[event] ??= []).push(cb)
      }
      constructor() { FakeXHR.instances.push(this) }
    }
    vi.stubGlobal('XMLHttpRequest', FakeXHR)

    const uploadPromise = api.uploadImageWithProgress(new File(['data'], 'photo.jpg'), () => {})
    const xhr = FakeXHR.instances[0]
    xhr.listeners['error']?.forEach(cb => cb())

    await expect(uploadPromise).rejects.toThrow('Erreur réseau')
  })

  it('uploadImageWithProgress surfaces the duplicate-file message on a 409', async () => {
    const { auth, api } = setup()
    auth.logout()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'tok_13' }) })
    await auth.login('admin', 'secret')

    class FakeXHR {
      static instances: FakeXHR[] = []
      status = 0
      responseText = ''
      upload = { addEventListener: vi.fn() }
      listeners: Record<string, Array<() => void>> = {}
      open = vi.fn()
      send = vi.fn()
      setRequestHeader = vi.fn()
      addEventListener(event: string, cb: () => void) {
        (this.listeners[event] ??= []).push(cb)
      }
      constructor() { FakeXHR.instances.push(this) }
    }
    vi.stubGlobal('XMLHttpRequest', FakeXHR)

    const uploadPromise = api.uploadImageWithProgress(new File(['data'], 'copy.jpg'), () => {})
    const xhr = FakeXHR.instances[0]
    xhr.status = 409
    xhr.responseText = JSON.stringify({ error: 'Ce fichier existe déjà ("plage.jpg")', duplicateOf: 'plage.jpg' })
    xhr.listeners['load']?.forEach(cb => cb())

    await expect(uploadPromise).rejects.toThrow('Ce fichier existe déjà ("plage.jpg")')
  })

  it('uploadImageWithProgress logs out and rejects on a 401', async () => {
    const { auth, api } = setup()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'tok_14' }) })
    await auth.login('admin', 'secret')

    class FakeXHR {
      static instances: FakeXHR[] = []
      status = 0
      responseText = ''
      upload = { addEventListener: vi.fn() }
      listeners: Record<string, Array<() => void>> = {}
      open = vi.fn()
      send = vi.fn()
      setRequestHeader = vi.fn()
      addEventListener(event: string, cb: () => void) {
        (this.listeners[event] ??= []).push(cb)
      }
      constructor() { FakeXHR.instances.push(this) }
    }
    vi.stubGlobal('XMLHttpRequest', FakeXHR)

    const uploadPromise = api.uploadImageWithProgress(new File(['data'], 'x.jpg'), () => {})
    const xhr = FakeXHR.instances[0]
    xhr.status = 401
    xhr.listeners['load']?.forEach(cb => cb())

    await expect(uploadPromise).rejects.toThrow('Session expirée')
    expect(auth.token.value).toBeNull()
  })

  it('uploadImageWithProgress rejects with a generic message when the 201 body is malformed', async () => {
    const { auth, api } = setup()
    auth.logout()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'tok_15' }) })
    await auth.login('admin', 'secret')

    class FakeXHR {
      static instances: FakeXHR[] = []
      status = 0
      responseText = ''
      upload = { addEventListener: vi.fn() }
      listeners: Record<string, Array<() => void>> = {}
      open = vi.fn()
      send = vi.fn()
      setRequestHeader = vi.fn()
      addEventListener(event: string, cb: () => void) {
        (this.listeners[event] ??= []).push(cb)
      }
      constructor() { FakeXHR.instances.push(this) }
    }
    vi.stubGlobal('XMLHttpRequest', FakeXHR)

    const uploadPromise = api.uploadImageWithProgress(new File(['data'], 'x.jpg'), () => {})
    const xhr = FakeXHR.instances[0]
    xhr.status = 201
    xhr.responseText = 'not json'
    xhr.listeners['load']?.forEach(cb => cb())

    await expect(uploadPromise).rejects.toThrow('Réponse invalide')
  })

  it('uploadImageWithProgress falls back to a status-code message when the error body is malformed', async () => {
    const { auth, api } = setup()
    auth.logout()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'tok_16' }) })
    await auth.login('admin', 'secret')

    class FakeXHR {
      static instances: FakeXHR[] = []
      status = 0
      responseText = ''
      upload = { addEventListener: vi.fn() }
      listeners: Record<string, Array<() => void>> = {}
      open = vi.fn()
      send = vi.fn()
      setRequestHeader = vi.fn()
      addEventListener(event: string, cb: () => void) {
        (this.listeners[event] ??= []).push(cb)
      }
      constructor() { FakeXHR.instances.push(this) }
    }
    vi.stubGlobal('XMLHttpRequest', FakeXHR)

    const uploadPromise = api.uploadImageWithProgress(new File(['data'], 'x.jpg'), () => {})
    const xhr = FakeXHR.instances[0]
    xhr.status = 500
    xhr.responseText = 'not json'
    xhr.listeners['load']?.forEach(cb => cb())

    await expect(uploadPromise).rejects.toThrow('Erreur 500')
  })

  it('getApiKeys requests the right URL and returns the keys array', async () => {
    const { auth, api } = setup()
    auth.logout()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'tok_13' }) })
    await auth.login('admin', 'secret')

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ keys: [{ id: '1', name: 'AbView', createdAt: 123 }] }),
    })

    const result = await api.getApiKeys()
    const [url] = fetchMock.mock.calls[1]
    expect(url).toBe('/api/keys')
    expect(result).toEqual([{ id: '1', name: 'AbView', createdAt: 123 }])
  })

  it('createApiKey posts the name and returns the created key', async () => {
    const { auth, api } = setup()
    auth.logout()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'tok_14' }) })
    await auth.login('admin', 'secret')

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: '1', name: 'AbView', createdAt: 123, key: 'abf_xxx' }),
    })

    const result = await api.createApiKey('AbView')
    const [url, opts] = fetchMock.mock.calls[1]
    expect(url).toBe('/api/keys')
    expect(JSON.parse(opts.body)).toEqual({ name: 'AbView' })
    expect(result).toEqual({ id: '1', name: 'AbView', createdAt: 123, key: 'abf_xxx' })
  })

  it('createApiKey throws the server error message on failure', async () => {
    const { auth, api } = setup()
    auth.logout()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'tok_15' }) })
    await auth.login('admin', 'secret')

    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'name required' }) })
    await expect(api.createApiKey('')).rejects.toThrow('name required')
  })

  it('deleteApiKey sends a DELETE to the right URL', async () => {
    const { auth, api } = setup()
    auth.logout()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'tok_16' }) })
    await auth.login('admin', 'secret')

    fetchMock.mockResolvedValueOnce({ ok: true })
    await api.deleteApiKey('1')
    const [url, opts] = fetchMock.mock.calls[1]
    expect(url).toBe('/api/keys/1')
    expect(opts.method).toBe('DELETE')
  })

  it('deleteApiKey throws on failure', async () => {
    const { auth, api } = setup()
    auth.logout()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'tok_17' }) })
    await auth.login('admin', 'secret')

    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 })
    await expect(api.deleteApiKey('ghost')).rejects.toThrow('Erreur suppression de la clé')
  })
})
