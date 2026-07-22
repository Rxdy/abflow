import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { render, screen, fireEvent, cleanup } from '@testing-library/vue'
import { flushPromises } from '@vue/test-utils'
import type { Stats } from '../../src/types'
import UploadView from '../../src/views/UploadView.vue'

const uploadImageWithProgress = vi.fn()
const refreshStats = vi.fn()
const stats = ref<Stats | null>(null)

vi.mock('../../src/composables/useApi', () => ({
  useApi: () => ({ uploadImageWithProgress }),
}))
vi.mock('../../src/composables/useStats', () => ({
  useStats: () => ({ stats, refreshStats }),
}))

function makeFile(name: string, size: number, type = 'image/jpeg'): File {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

function getFileInput(): HTMLInputElement {
  return document.querySelector('input[type="file"]') as HTMLInputElement
}

beforeEach(() => {
  uploadImageWithProgress.mockReset()
  refreshStats.mockReset()
  stats.value = null
})

afterEach(() => cleanup())

describe('UploadView', () => {
  it('adds a selected file to the queue as pending', async () => {
    render(UploadView)
    await fireEvent.change(getFileInput(), { target: { files: [makeFile('photo.jpg', 1024)] } })

    expect(screen.getByText('photo.jpg')).toBeTruthy()
    expect(screen.getByText('En attente')).toBeTruthy()
    expect(screen.getByText(/Publier 1 fichier/)).toBeTruthy()
  })

  it('rejects a file over 200MB before queueing it', async () => {
    render(UploadView)
    await fireEvent.change(getFileInput(), { target: { files: [makeFile('huge.mp4', 201 * 1024 * 1024)] } })

    expect(screen.getByRole('alert').textContent).toMatch(/dépasse 200 Mo/)
    expect(screen.queryByText('huge.mp4')).toBeNull()
  })

  it('removes a pending item from the queue', async () => {
    render(UploadView)
    await fireEvent.change(getFileInput(), { target: { files: [makeFile('a.jpg', 100)] } })
    expect(screen.getByText('a.jpg')).toBeTruthy()

    await fireEvent.click(screen.getByText('✕'))
    expect(screen.queryByText('a.jpg')).toBeNull()
  })

  it('uploads pending files and shows a success message', async () => {
    uploadImageWithProgress.mockImplementation(async (_file: File, onProgress: (pct: number) => void) => {
      onProgress(100)
      return { filename: 'gen.jpg', url: '/uploads/gen.jpg', size: 100, uploadedAt: 1, fileType: 'image' }
    })
    render(UploadView)
    await fireEvent.change(getFileInput(), { target: { files: [makeFile('a.jpg', 100)] } })
    await fireEvent.click(screen.getByText(/Publier 1 fichier/))
    await flushPromises()

    expect(screen.getByRole('status').textContent).toMatch(/1 fichier publié/)
    expect(refreshStats).toHaveBeenCalled()
  })

  it('shows an error badge with the failure message when an upload fails', async () => {
    uploadImageWithProgress.mockRejectedValue(new Error('Quota dépassé'))
    render(UploadView)
    await fireEvent.change(getFileInput(), { target: { files: [makeFile('a.jpg', 100)] } })
    await fireEvent.click(screen.getByText(/Publier 1 fichier/))
    await flushPromises()

    expect(screen.getByTitle('Quota dépassé')).toBeTruthy()
  })

  it('renders the stats card when stats are available', () => {
    stats.value = { count: 3, totalSize: 2 * 1024 * 1024, byType: {}, quotaBytes: null }
    render(UploadView)
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.getByText('2.0 Mo')).toBeTruthy()
  })
})
