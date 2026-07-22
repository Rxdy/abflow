import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/vue'
import { flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import LoginView from '../../src/views/LoginView.vue'

let fetchMock: ReturnType<typeof vi.fn>

async function mount(initialPath = '/') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'login', component: LoginView },
      { path: '/files', name: 'files', component: { template: '<div>files</div>' } },
    ],
  })
  await router.push(initialPath)
  return { ...render(LoginView, { global: { plugins: [router] } }), router }
}

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('LoginView', () => {
  it('shows a validation message when submitted empty', async () => {
    await mount()
    await fireEvent.click(screen.getByRole('button', { name: /se connecter/i }))
    expect(await screen.findByText(/remplir tous les champs/i)).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows a French error message on invalid credentials', async () => {
    await mount()
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Invalid credentials' }) })

    await fireEvent.update(screen.getByLabelText(/identifiant/i), 'admin')
    await fireEvent.update(screen.getByLabelText(/mot de passe/i), 'wrong')
    await fireEvent.click(screen.getByRole('button', { name: /se connecter/i }))
    await flushPromises()

    expect(await screen.findByText(/identifiant ou mot de passe incorrect/i)).toBeTruthy()
  })

  it('shows a generic error message on network/server failure', async () => {
    await mount()
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'boom' }) })

    await fireEvent.update(screen.getByLabelText(/identifiant/i), 'admin')
    await fireEvent.update(screen.getByLabelText(/mot de passe/i), 'secret')
    await fireEvent.click(screen.getByRole('button', { name: /se connecter/i }))
    await flushPromises()

    expect(await screen.findByText(/erreur de connexion/i)).toBeTruthy()
  })

  it('logs in and redirects to /files on success', async () => {
    const { router } = await mount()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'tok_login' }) })

    await fireEvent.update(screen.getByLabelText(/identifiant/i), 'admin')
    await fireEvent.update(screen.getByLabelText(/mot de passe/i), 'secret')
    await fireEvent.click(screen.getByRole('button', { name: /se connecter/i }))
    await flushPromises()

    expect(localStorage.getItem('auth_token')).toBe('tok_login')
    expect(router.currentRoute.value.name).toBe('files')
  })

  it('shows the session-expired banner when redirected with ?expired=1', async () => {
    await mount('/?expired=1')
    expect(screen.getByText(/session expirée/i)).toBeTruthy()
  })
})
