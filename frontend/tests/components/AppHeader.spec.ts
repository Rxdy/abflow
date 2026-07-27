import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/vue'
import { flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import AppHeader from '../../src/components/AppHeader.vue'
import { useAuth } from '../../src/composables/useAuth'
import { setupWithRouter } from '../helpers/withRouter'

let fetchMock: ReturnType<typeof vi.fn>

async function mount() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'login', component: { template: '<div/>' } },
      { path: '/settings', name: 'settings', component: { template: '<div/>' } },
    ],
  })
  const result = render(AppHeader, { global: { plugins: [router] } })
  await flushPromises()
  return result
}

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  localStorage.setItem('auth_token', 'tok_test')
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('AppHeader storage bar', () => {
  it('shows nothing when there is no quota configured', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ count: 1, totalSize: 1000, byType: {}, quotaBytes: null }),
    })
    await mount()
    expect(screen.queryByText(/restants sur/)).toBeNull()
  })

  it('shows the remaining space when a quota is configured', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ count: 1, totalSize: 500_000_000, byType: {}, quotaBytes: 2_000_000_000 }),
    })
    await mount()
    expect(screen.getByText(/restants sur 1\.86 Go/)).toBeTruthy()
  })

  it('flags the bar as danger past 90% usage', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ count: 1, totalSize: 1_950_000_000, byType: {}, quotaBytes: 2_000_000_000 }),
    })
    await mount()
    const label = screen.getByText(/restants sur/)
    const fill = label.parentElement!.querySelector('.storage-bar-fill')
    expect(fill?.className).toContain('storage-bar-fill--danger')
  })

  it('shows the exact byte counts in the hover tooltip, unlike the rounded label', async () => {
    // 4 161 489 o utilisés sur un quota de 2 097 152 000 o — les deux arrondissent
    // à "1.95 Go" restants avec formatSize(), d'où la confusion à l'origine de ce test.
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ count: 3, totalSize: 4_161_489, byType: {}, quotaBytes: 2_097_152_000 }),
    })
    await mount()
    const bar = document.querySelector('.storage-bar')
    const n = (x: number) => x.toLocaleString('fr-FR')
    expect(bar?.getAttribute('title')).toBe(
      `${n(4_161_489)} o utilisés sur ${n(2_097_152_000)} o (${n(2_092_990_511)} o restants) — 0.20 %`,
    )
  })
})

describe('AppHeader settings link', () => {
  // token est un ref singleton au niveau module (voir useAuth.ts), initialisé une
  // seule fois depuis localStorage à l'import — le localStorage.setItem() du
  // beforeEach global ne le fait donc jamais passer à true après coup. Il faut
  // passer par useAuth() pour le mettre à jour réellement.
  afterEach(() => { setupWithRouter(() => useAuth()).result.token.value = null })

  it('links to /settings', async () => {
    setupWithRouter(() => useAuth()).result.token.value = 'tok_test'
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ count: 0, totalSize: 0, byType: {}, quotaBytes: null }),
    })
    await mount()
    expect(screen.getByTitle('Clés API').getAttribute('href')).toBe('/settings')
  })
})
