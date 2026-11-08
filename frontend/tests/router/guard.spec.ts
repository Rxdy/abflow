import { jeton } from '../helpers/jeton'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import router from '../../src/router'

// Chaque navigation utilise une query unique — pousser deux fois vers exactement
// la même route (même path+query) est traité par vue-router comme une navigation
// dupliquée et n'exécute pas le garde une seconde fois, ce qui fausserait les tests
// suivants dans ce fichier (le router est un singleton partagé).
let n = 0
function unique(path: string): string {
  n += 1
  return `${path}?t=${n}`
}

describe('router navigation guard', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('redirects to /login when visiting a protected route without a token', async () => {
    await router.push(unique('/files'))
    expect(router.currentRoute.value.name).toBe('login')
  })

  it('allows a protected route when a token is present', async () => {
    localStorage.setItem('auth_token', jeton('present'))
    await router.push(unique('/files'))
    expect(router.currentRoute.value.name).toBe('files')
  })

  it('redirects an already-logged-in user away from /login to /upload', async () => {
    localStorage.setItem('auth_token', jeton('present'))
    await router.push(unique('/'))
    expect(router.currentRoute.value.name).toBe('upload')
  })

  it('lets a guest reach /login', async () => {
    await router.push(unique('/'))
    expect(router.currentRoute.value.name).toBe('login')
  })

  it('redirects unknown paths to /login', async () => {
    await router.push(unique('/does/not/exist'))
    expect(router.currentRoute.value.name).toBe('login')
  })
})

describe('router navigation guard : session persistante', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('un jeton expiré est renouvelé par le cookie de session : on ne repasse pas par la connexion', async () => {
    localStorage.setItem('auth_token', jeton('vieux', -60))
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ token: jeton('neuf') }) })
    vi.stubGlobal('fetch', fetchMock)
    await router.push(unique('/files'))
    expect(router.currentRoute.value.name).toBe('files')
    expect(localStorage.getItem('auth_token')).toBe(jeton('neuf'))
    vi.unstubAllGlobals()
  })

  it('jeton expiré et pas de session : retour à la connexion, jeton périmé retiré', async () => {
    localStorage.setItem('auth_token', jeton('vieux', -60))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }))
    await router.push(unique('/files'))
    expect(router.currentRoute.value.name).toBe('login')
    expect(localStorage.getItem('auth_token')).toBeNull()
    vi.unstubAllGlobals()
  })
})
