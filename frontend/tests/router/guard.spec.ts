import { describe, it, expect, beforeEach } from 'vitest'
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
    localStorage.setItem('auth_token', 'tok_present')
    await router.push(unique('/files'))
    expect(router.currentRoute.value.name).toBe('files')
  })

  it('redirects an already-logged-in user away from /login to /upload', async () => {
    localStorage.setItem('auth_token', 'tok_present')
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
