import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import App from '../src/App.vue'

vi.mock('../src/composables/useStats', () => ({
  useStats: () => ({ stats: { value: null }, refreshStats: vi.fn() }),
}))

async function mount(path: string, meta: Record<string, boolean>) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: { template: '<div/>' }, meta },
      { path: '/files', name: 'files', component: { template: '<div/>' }, meta },
    ],
  })
  await router.push(path)
  return render(App, { global: { plugins: [router] } })
}

afterEach(() => cleanup())

describe('App shell', () => {
  it('shows the header and bottom nav on an authenticated route', async () => {
    await mount('/files', { requiresAuth: true })
    expect(document.querySelector('.app-header')).toBeTruthy()
    expect(document.querySelector('.bottom-nav')).toBeTruthy()
    expect(document.querySelector('.app-footer')).toBeNull()
  })

  it('shows only the footer on a guest route', async () => {
    await mount('/login', {})
    expect(document.querySelector('.app-header')).toBeNull()
    expect(document.querySelector('.bottom-nav')).toBeNull()
    expect(document.querySelector('.app-footer')).toBeTruthy()
  })
})
