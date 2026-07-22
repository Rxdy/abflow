import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import BottomNav from '../../src/components/BottomNav.vue'

async function mount(initialPath: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/files', name: 'files', component: { template: '<div/>' } },
      { path: '/upload', name: 'upload', component: { template: '<div/>' } },
    ],
  })
  await router.push(initialPath)
  render(BottomNav, { global: { plugins: [router] } })
}

describe('BottomNav', () => {
  it('links to /files and /upload', async () => {
    await mount('/files')
    expect(screen.getByText('Fichiers').closest('a')?.getAttribute('href')).toBe('/files')
    expect(screen.getByText('Ajouter').closest('a')?.getAttribute('href')).toBe('/upload')
  })

  it('marks the current route as active', async () => {
    await mount('/upload')
    expect(screen.getByText('Ajouter').closest('a')?.classList.contains('nav-item--active')).toBe(true)
    expect(screen.getByText('Fichiers').closest('a')?.classList.contains('nav-item--active')).toBe(false)
  })
})
