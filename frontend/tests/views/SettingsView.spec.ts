import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/vue'
import { flushPromises } from '@vue/test-utils'
import type { ApiKey, ApiKeyCreated } from '../../src/types'
import SettingsView from '../../src/views/SettingsView.vue'

const getApiKeys   = vi.fn<[], Promise<ApiKey[]>>()
const createApiKey = vi.fn<[string], Promise<ApiKeyCreated>>()
const deleteApiKey  = vi.fn<[string], Promise<void>>()

vi.mock('../../src/composables/useApi', () => ({
  useApi: () => ({ getApiKeys, createApiKey, deleteApiKey }),
}))

beforeEach(() => {
  getApiKeys.mockReset().mockResolvedValue([])
  createApiKey.mockReset()
  deleteApiKey.mockReset()
})

afterEach(() => cleanup())

describe('SettingsView', () => {
  it('shows an empty hint when there are no keys', async () => {
    render(SettingsView)
    await flushPromises()
    expect(screen.getByText(/Aucune clé pour l'instant/)).toBeTruthy()
  })

  it('lists existing keys with their name', async () => {
    getApiKeys.mockResolvedValue([{ id: '1', name: 'AbView', createdAt: Date.now() }])
    render(SettingsView)
    await flushPromises()
    expect(screen.getByText('AbView')).toBeTruthy()
  })

  it('creates a key and reveals the plaintext value once', async () => {
    createApiKey.mockResolvedValue({ id: '2', name: 'AbView', createdAt: Date.now(), key: 'abf_secret123' })
    render(SettingsView)
    await flushPromises()

    await fireEvent.update(screen.getByPlaceholderText(/Nom de la clé/), 'AbView')
    await fireEvent.click(screen.getByText('Générer une clé'))
    await flushPromises()

    expect(createApiKey).toHaveBeenCalledWith('AbView')
    expect(screen.getByText('abf_secret123')).toBeTruthy()
  })

  it('disables the submit button while the name is empty', async () => {
    render(SettingsView)
    await flushPromises()
    const btn = screen.getByText('Générer une clé') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('surfaces the server error message when key creation fails', async () => {
    createApiKey.mockRejectedValue(new Error('name required'))
    render(SettingsView)
    await flushPromises()

    await fireEvent.update(screen.getByPlaceholderText(/Nom de la clé/), 'x')
    await fireEvent.click(screen.getByText('Générer une clé'))
    await flushPromises()

    expect(screen.getByRole('alert').textContent).toMatch(/name required/)
  })

  it('revokes a key after confirming', async () => {
    getApiKeys.mockResolvedValue([{ id: '1', name: 'AbView', createdAt: Date.now() }])
    deleteApiKey.mockResolvedValue(undefined)
    render(SettingsView)
    await flushPromises()

    await fireEvent.click(screen.getByTitle('Révoquer'))
    expect(screen.getByText(/Révoquer "AbView" ?/)).toBeTruthy()

    getApiKeys.mockResolvedValue([])
    await fireEvent.click(screen.getByText('Révoquer'))
    await flushPromises()

    expect(deleteApiKey).toHaveBeenCalledWith('1')
    expect(screen.queryByText('AbView')).toBeNull()
  })
})
