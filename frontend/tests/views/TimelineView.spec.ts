import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/vue'
import { flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import type { FileEntry } from '../../src/types'
import TimelineView from '../../src/views/TimelineView.vue'

const getImages = vi.fn()
const deleteImages = vi.fn()
const downloadFile = vi.fn()
const createShareLink = vi.fn()
const mediaUrl = vi.fn((url: string) => url)

vi.mock('../../src/composables/useApi', () => ({
  useApi: () => ({ getImages, deleteImages, downloadFile, createShareLink, mediaUrl }),
}))

function makeFile(overrides: Partial<FileEntry> = {}): FileEntry {
  return {
    filename: '1700000000000-abc123-file.jpg',
    url: '/uploads/1700000000000-abc123-file.jpg',
    uploadedAt: Date.now(),
    size: 1024,
    fileType: 'image',
    ...overrides,
  }
}

async function mount() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/upload', name: 'upload', component: { template: '<div/>' } },
      { path: '/', name: 'files', component: { template: '<div/>' } },
    ],
  })
  return render(TimelineView, { global: { plugins: [router] } })
}

beforeEach(() => {
  getImages.mockReset()
  deleteImages.mockReset()
  downloadFile.mockReset()
  createShareLink.mockReset()
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  })
})

afterEach(() => cleanup())

describe('TimelineView', () => {
  it('shows a spinner while loading', async () => {
    let resolveFn!: (v: unknown) => void
    getImages.mockReturnValue(new Promise(resolve => { resolveFn = resolve }))
    await mount()
    expect(document.querySelector('.spinner-lg')).toBeTruthy()
    resolveFn({ total: 0, limit: 50, offset: 0, images: [] })
    await flushPromises()
  })

  it('shows an error message when loading fails', async () => {
    getImages.mockRejectedValue(new Error('Erreur chargement fichiers'))
    await mount()
    await flushPromises()
    expect(screen.getByText('Erreur chargement fichiers')).toBeTruthy()
  })

  it('shows an empty state with a link to /upload when there are no files', async () => {
    getImages.mockResolvedValue({ total: 0, limit: 50, offset: 0, images: [] })
    await mount()
    await flushPromises()
    expect(screen.getByText(/Aucun fichier/)).toBeTruthy()
    expect(screen.getByText('Ajouter un fichier').closest('a')?.getAttribute('href')).toBe('/upload')
  })

  it('renders images in a grid and other files in a doc list', async () => {
    const files = [
      makeFile({ filename: '1700000000000-a1-photo.jpg', fileType: 'image' }),
      makeFile({ filename: '1700000000000-b2-report.pdf', fileType: 'document', size: 2048 }),
    ]
    getImages.mockResolvedValue({ total: 2, limit: 50, offset: 0, images: files })
    await mount()
    await flushPromises()

    expect(document.querySelectorAll('.file-cell').length).toBe(1)
    expect(document.querySelectorAll('.doc-item').length).toBe(1)
    expect(screen.getByText('report')).toBeTruthy()
  })

  it('filters files by type via the filter chips', async () => {
    const files = [
      makeFile({ filename: '1700000000000-a1-a.jpg', fileType: 'image' }),
      makeFile({ filename: '1700000000000-b2-b.mp4', fileType: 'video', size: 5000 }),
    ]
    getImages.mockResolvedValue({ total: 2, limit: 50, offset: 0, images: files })
    await mount()
    await flushPromises()

    expect(document.querySelectorAll('.file-cell, .doc-item').length).toBe(2)
    await fireEvent.click(screen.getByText('Vidéos'))
    expect(document.querySelectorAll('.file-cell, .doc-item').length).toBe(1)
    expect(document.querySelectorAll('.doc-item').length).toBe(1)
  })

  it('searches files by their cleaned name', async () => {
    const files = [
      makeFile({ filename: '1700000000000-a1-holiday.jpg', fileType: 'document' }),
      makeFile({ filename: '1700000000000-b2-invoice.pdf', fileType: 'document' }),
    ]
    getImages.mockResolvedValue({ total: 2, limit: 50, offset: 0, images: files })
    await mount()
    await flushPromises()

    await fireEvent.update(screen.getByPlaceholderText('Rechercher…'), 'invoice')
    expect(document.querySelectorAll('.doc-item').length).toBe(1)
    expect(screen.getByText('invoice')).toBeTruthy()
  })

  it('sorts files by name', async () => {
    const files = [
      makeFile({ filename: '1700000000000-a1-zebra.pdf', fileType: 'document' }),
      makeFile({ filename: '1700000000000-b2-apple.pdf', fileType: 'document' }),
    ]
    getImages.mockResolvedValue({ total: 2, limit: 50, offset: 0, images: files })
    await mount()
    await flushPromises()

    await fireEvent.update(screen.getByDisplayValue('Date'), 'name')
    const names = [...document.querySelectorAll('.doc-name')].map(n => n.textContent)
    expect(names).toEqual(['apple', 'zebra'])
  })

  it('loads more files and hides the button once everything is loaded', async () => {
    const first = [makeFile({ filename: '1700000000000-a1-1.jpg' })]
    const second = [makeFile({ filename: '1700000000000-b2-2.jpg' })]
    getImages.mockResolvedValueOnce({ total: 2, limit: 50, offset: 0, images: first })
    await mount()
    await flushPromises()

    expect(screen.getByText(/Charger plus/)).toBeTruthy()
    getImages.mockResolvedValueOnce({ total: 2, limit: 50, offset: 1, images: second })
    await fireEvent.click(screen.getByText(/Charger plus/))
    await flushPromises()

    expect(document.querySelectorAll('.file-cell').length).toBe(2)
    expect(screen.queryByText(/Charger plus/)).toBeNull()
  })

  it('opens the lightbox on an image click and navigates with the arrows', async () => {
    const files = [
      makeFile({ filename: '1700000000000-a1-1.jpg' }),
      makeFile({ filename: '1700000000000-b2-2.jpg' }),
    ]
    getImages.mockResolvedValue({ total: 2, limit: 50, offset: 0, images: files })
    await mount()
    await flushPromises()

    const cells = document.querySelectorAll('.file-cell')
    await fireEvent.click(cells[0])
    expect(screen.getByText('1 / 2')).toBeTruthy()

    await fireEvent.click(document.querySelector('.lb-next')!)
    expect(screen.getByText('2 / 2')).toBeTruthy()

    await fireEvent.click(document.querySelector('.lb-close')!)
    expect(document.querySelector('.lightbox')).toBeNull()
  })

  it('navigates the lightbox with keyboard arrows and closes on Escape', async () => {
    const files = [
      makeFile({ filename: '1700000000000-a1-1.jpg' }),
      makeFile({ filename: '1700000000000-b2-2.jpg' }),
    ]
    getImages.mockResolvedValue({ total: 2, limit: 50, offset: 0, images: files })
    await mount()
    await flushPromises()

    await fireEvent.click(document.querySelectorAll('.file-cell')[0])
    expect(screen.getByText('1 / 2')).toBeTruthy()

    await fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText('2 / 2')).toBeTruthy()

    await fireEvent.keyDown(window, { key: 'Escape' })
    expect(document.querySelector('.lightbox')).toBeNull()
  })

  it('opens the media viewer for a video file', async () => {
    const files = [makeFile({ filename: '1700000000000-a1-clip.mp4', fileType: 'video' })]
    getImages.mockResolvedValue({ total: 1, limit: 50, offset: 0, images: files })
    await mount()
    await flushPromises()

    await fireEvent.click(document.querySelector('.doc-item')!)
    const video = document.querySelector('video.lb-media')
    expect(video?.getAttribute('src')).toBe(files[0].url)
  })

  it('copies a share link to the clipboard', async () => {
    const files = [makeFile({ filename: '1700000000000-a1-report.pdf', fileType: 'document' })]
    getImages.mockResolvedValue({ total: 1, limit: 50, offset: 0, images: files })
    createShareLink.mockResolvedValue({ url: '/share/xyz', expiresAt: 123 })
    await mount()
    await flushPromises()

    await fireEvent.click(screen.getByTitle('Partager'))
    await flushPromises()

    expect(createShareLink).toHaveBeenCalledWith(files[0].filename)
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`${window.location.origin}/share/xyz`)
    await waitFor(() => expect(screen.getByText('Lien copié !')).toBeTruthy())
  })

  it('calls downloadFile when clicking the download button', async () => {
    const files = [makeFile({ filename: '1700000000000-a1-report.pdf', fileType: 'document' })]
    getImages.mockResolvedValue({ total: 1, limit: 50, offset: 0, images: files })
    await mount()
    await flushPromises()

    await fireEvent.click(screen.getByTitle(files[0].filename))
    expect(downloadFile).toHaveBeenCalledWith(files[0].filename, files[0].url)
  })
})
