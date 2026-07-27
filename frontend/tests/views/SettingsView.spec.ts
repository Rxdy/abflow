import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/vue'
import { flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import type { ApiKey, ApiKeyCreated } from '../../src/types'
import SettingsView from '../../src/views/SettingsView.vue'

const getApiKeys   = vi.fn<[], Promise<ApiKey[]>>()
const createApiKey = vi.fn<[string], Promise<ApiKeyCreated>>()
const deleteApiKey  = vi.fn<[string], Promise<void>>()

vi.mock('../../src/composables/useApi', () => ({
  useApi: () => ({ getApiKeys, createApiKey, deleteApiKey }),
}))

function mount() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/settings', name: 'settings', component: SettingsView },
      { path: '/files', name: 'files', component: { template: '<div>files</div>' } },
    ],
  })
  const result = render(SettingsView, { global: { plugins: [router] } })
  return { ...result, router }
}

beforeEach(() => {
  getApiKeys.mockReset().mockResolvedValue([])
  createApiKey.mockReset()
  deleteApiKey.mockReset()
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  })
})

afterEach(() => cleanup())

describe('SettingsView', () => {
  it('shows an empty hint when there are no keys', async () => {
    mount()
    await flushPromises()
    expect(screen.getByText(/Aucune clé pour l'instant/)).toBeTruthy()
  })

  it('lists existing keys with their name', async () => {
    getApiKeys.mockResolvedValue([{ id: '1', name: 'AbView', createdAt: Date.now() }])
    mount()
    await flushPromises()
    expect(screen.getByText('AbView')).toBeTruthy()
  })

  it('has a back button that returns to the files view', async () => {
    const { router } = mount()
    await flushPromises()
    const back = screen.getByTitle('Retour')
    expect(back.getAttribute('href')).toBe('/files')

    await fireEvent.click(back)
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('files')
  })

  it('creates a key and reveals the plaintext value once', async () => {
    createApiKey.mockResolvedValue({ id: '2', name: 'AbView', createdAt: Date.now(), key: 'abf_secret123' })
    mount()
    await flushPromises()

    await fireEvent.update(screen.getByPlaceholderText(/Nom de la clé/), 'AbView')
    await fireEvent.click(screen.getByText('Générer une clé'))
    await flushPromises()

    expect(createApiKey).toHaveBeenCalledWith('AbView')
    expect(screen.getByText('abf_secret123')).toBeTruthy()
  })

  it('disables the submit button while the name is empty', async () => {
    mount()
    await flushPromises()
    const btn = screen.getByText('Générer une clé') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('does not call createApiKey when the form is submitted with a blank name', async () => {
    mount()
    await flushPromises()

    // Le bouton est désactivé, mais on soumet le formulaire directement pour
    // vérifier que doCreate() lui-même se protège aussi contre un nom vide.
    await fireEvent.submit(document.querySelector('.new-key-form')!)
    await flushPromises()

    expect(createApiKey).not.toHaveBeenCalled()
  })

  it('surfaces the server error message when key creation fails', async () => {
    createApiKey.mockRejectedValue(new Error('name required'))
    mount()
    await flushPromises()

    await fireEvent.update(screen.getByPlaceholderText(/Nom de la clé/), 'x')
    await fireEvent.click(screen.getByText('Générer une clé'))
    await flushPromises()

    expect(screen.getByRole('alert').textContent).toMatch(/name required/)
  })

  it('revokes a key after confirming', async () => {
    getApiKeys.mockResolvedValue([{ id: '1', name: 'AbView', createdAt: Date.now() }])
    deleteApiKey.mockResolvedValue(undefined)
    mount()
    await flushPromises()

    await fireEvent.click(screen.getByTitle('Révoquer'))
    expect(screen.getByText(/Révoquer "AbView" ?/)).toBeTruthy()

    getApiKeys.mockResolvedValue([])
    await fireEvent.click(screen.getByText('Révoquer'))
    await flushPromises()

    expect(deleteApiKey).toHaveBeenCalledWith('1')
    expect(screen.queryByText('AbView')).toBeNull()
  })

  it('surfaces an error message when the key list fails to load', async () => {
    getApiKeys.mockRejectedValue(new Error('Erreur chargement des clés'))
    mount()
    await flushPromises()

    expect(screen.getByRole('alert').textContent).toMatch(/Erreur chargement des clés/)
  })

  it('copies the revealed key to the clipboard', async () => {
    createApiKey.mockResolvedValue({ id: '2', name: 'AbView', createdAt: Date.now(), key: 'abf_secret123' })
    mount()
    await flushPromises()

    await fireEvent.update(screen.getByPlaceholderText(/Nom de la clé/), 'AbView')
    await fireEvent.click(screen.getByText('Générer une clé'))
    await flushPromises()

    await fireEvent.click(screen.getByText('Copier'))
    await flushPromises()

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('abf_secret123')
    expect(screen.getByText('Copié !')).toBeTruthy()
  })

  it('surfaces an error message when revoking a key fails', async () => {
    getApiKeys.mockResolvedValue([{ id: '1', name: 'AbView', createdAt: Date.now() }])
    deleteApiKey.mockRejectedValue(new Error('Erreur suppression de la clé'))
    mount()
    await flushPromises()

    await fireEvent.click(screen.getByTitle('Révoquer'))
    await fireEvent.click(screen.getByText('Révoquer'))
    await flushPromises()

    expect(screen.getByRole('alert').textContent).toMatch(/Erreur suppression de la clé/)
    // La clé reste dans la liste — la révocation a échoué côté serveur.
    expect(screen.getByText('AbView')).toBeTruthy()
  })

  it('closes the revealed-key dialog with "Fermer"', async () => {
    createApiKey.mockResolvedValue({ id: '2', name: 'AbView', createdAt: Date.now(), key: 'abf_secret123' })
    mount()
    await flushPromises()

    await fireEvent.update(screen.getByPlaceholderText(/Nom de la clé/), 'AbView')
    await fireEvent.click(screen.getByText('Générer une clé'))
    await flushPromises()
    expect(screen.getByText('abf_secret123')).toBeTruthy()

    await fireEvent.click(screen.getByText('Fermer'))
    expect(screen.queryByText('abf_secret123')).toBeNull()
  })

  it('closes the revoke confirmation when clicking the backdrop itself', async () => {
    getApiKeys.mockResolvedValue([{ id: '1', name: 'AbView', createdAt: Date.now() }])
    mount()
    await flushPromises()

    await fireEvent.click(screen.getByTitle('Révoquer'))
    const overlay = document.querySelector('.dialog-overlay')!
    await fireEvent.click(overlay)

    expect(document.querySelector('.dialog-overlay')).toBeNull()
    expect(deleteApiKey).not.toHaveBeenCalled()
  })

  it('cancels revocation with "Annuler" without deleting the key', async () => {
    getApiKeys.mockResolvedValue([{ id: '1', name: 'AbView', createdAt: Date.now() }])
    mount()
    await flushPromises()

    await fireEvent.click(screen.getByTitle('Révoquer'))
    await fireEvent.click(screen.getByText('Annuler'))

    expect(deleteApiKey).not.toHaveBeenCalled()
    expect(screen.getByText('AbView')).toBeTruthy()
  })
})
