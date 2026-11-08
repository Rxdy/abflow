import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { refreshSession, ensureFreshToken, useAuth } from '../../src/composables/useAuth'
import { useApi } from '../../src/composables/useApi'
import { setupWithRouter } from '../helpers/withRouter'
import { jeton } from '../helpers/jeton'

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  localStorage.clear()
})
afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

const ok = (corps: unknown, status = 200) => ({ ok: status < 400, status, json: async () => corps })

describe('connexion persistante : renouvellement par le cookie de session', () => {
  it('refreshSession demande un nouveau jeton, le garde et le range dans localStorage', async () => {
    fetchMock.mockResolvedValueOnce(ok({ token: jeton('neuf') }))
    expect(await refreshSession()).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/refresh', { method: 'POST' })
    expect(localStorage.getItem('auth_token')).toBe(jeton('neuf'))
  })

  it('refreshSession rend faux sans session valide, et ne touche pas au jeton', async () => {
    fetchMock.mockResolvedValueOnce(ok({ error: 'No valid session' }, 401))
    expect(await refreshSession()).toBe(false)
    expect(localStorage.getItem('auth_token')).toBeNull()
  })

  it('deux renouvellements simultanés ne font qu\'un seul appel', async () => {
    fetchMock.mockResolvedValue(ok({ token: jeton('un') }))
    const [a, b] = await Promise.all([refreshSession(), refreshSession()])
    expect(a && b).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('ensureFreshToken ne fait aucun appel tant que le jeton vaut encore plus de 5 minutes', async () => {
    localStorage.setItem('auth_token', jeton('frais', 3600))
    expect(await ensureFreshToken()).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('ensureFreshToken renouvelle un jeton expiré (la personne revient le lendemain)', async () => {
    localStorage.setItem('auth_token', jeton('vieux', -10))
    fetchMock.mockResolvedValueOnce(ok({ token: jeton('renouvele') }))
    expect(await ensureFreshToken()).toBe(true)
    expect(localStorage.getItem('auth_token')).toBe(jeton('renouvele'))
  })

  it('ensureFreshToken rend faux : pas de jeton et pas de session', async () => {
    fetchMock.mockResolvedValueOnce(ok({}, 401))
    expect(await ensureFreshToken()).toBe(false)
  })

  it('ensureFreshToken garde un jeton encore valable quand le réseau est coupé', async () => {
    localStorage.setItem('auth_token', jeton('court', 120)) // < 5 min, mais pas expiré
    fetchMock.mockRejectedValueOnce(new Error('hors ligne'))
    expect(await ensureFreshToken()).toBe(true)
  })

  it('une requête refusée (401) est refaite une fois avec le jeton renouvelé', async () => {
    localStorage.setItem('auth_token', jeton('ancien', 3600))
    let api!: ReturnType<typeof useApi>
    setupWithRouter(() => { api = useApi(); return null })
    fetchMock
      .mockResolvedValueOnce(ok({}, 401)) // la requête
      .mockResolvedValueOnce(ok({ token: jeton('nouveau') })) // le renouvellement
      .mockResolvedValueOnce(ok({ total: 0, limit: 50, offset: 0, images: [] })) // la requête refaite
    const res = await api.getImages()
    expect(res.images).toEqual([])
    const refaite = fetchMock.mock.calls[2]
    expect(refaite[1].headers.Authorization).toBe(`Bearer ${jeton('nouveau')}`)
  })

  it('sans session valide, un 401 renvoie vers la connexion', async () => {
    localStorage.setItem('auth_token', jeton('ancien', 3600))
    let api!: ReturnType<typeof useApi>
    let auth!: ReturnType<typeof useAuth>
    const { router } = setupWithRouter(() => { api = useApi(); auth = useAuth(); return null })
    fetchMock.mockResolvedValue(ok({}, 401))
    await expect(api.getImages()).rejects.toThrow()
    await flushPromises()
    expect(auth.token.value).toBeNull()
    expect(router.currentRoute.value.name).toBe('login')
  })

  it('la déconnexion efface aussi le cookie de session', async () => {
    let auth!: ReturnType<typeof useAuth>
    setupWithRouter(() => { auth = useAuth(); return null })
    fetchMock.mockResolvedValue(ok({}))
    auth.logout()
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' })
  })
})
