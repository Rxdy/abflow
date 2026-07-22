import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/vue'
import { flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import AppHeader from '../../src/components/AppHeader.vue'

let fetchMock: ReturnType<typeof vi.fn>

async function mount() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', name: 'login', component: { template: '<div/>' } }],
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
})
