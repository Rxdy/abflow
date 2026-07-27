import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/vue'
import { flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import type { FileEntry } from '../../src/types'
import TimelineView from '../../src/views/TimelineView.vue'

const getImages = vi.fn()
const deleteImages = vi.fn()
const downloadFile = vi.fn()
const createShareLink = vi.fn()
const mediaUrl = vi.fn((url: string) => url)
const renameFile = vi.fn()

vi.mock('../../src/composables/useApi', () => ({
  useApi: () => ({ getImages, deleteImages, downloadFile, createShareLink, mediaUrl, renameFile }),
}))

function makeFile(overrides: Partial<FileEntry> = {}): FileEntry {
  return {
    filename: '1700000000000-abc123-file.jpg',
    url: '/uploads/1700000000000-abc123-file.jpg',
    uploadedAt: Date.now(),
    size: 1024,
    fileType: 'image',
    displayName: null,
    originalName: null,
    mimeType: null,
    width: null,
    height: null,
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
  renameFile.mockReset()
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  })
})

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

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

  it('shows the file size in the image lightbox', async () => {
    const files = [makeFile({ filename: '1700000000000-a1-1.jpg', size: 2 * 1024 * 1024 })]
    getImages.mockResolvedValue({ total: 1, limit: 50, offset: 0, images: files })
    await mount()
    await flushPromises()

    await fireEvent.click(document.querySelector('.file-cell')!)
    expect(document.querySelector('.lb-meta')!.textContent).toMatch(/2\.0 Mo/)
  })

  it('shows the image dimensions in the lightbox when known', async () => {
    const files = [makeFile({ filename: '1700000000000-a1-1.jpg', width: 1920, height: 1080 })]
    getImages.mockResolvedValue({ total: 1, limit: 50, offset: 0, images: files })
    await mount()
    await flushPromises()

    await fireEvent.click(document.querySelector('.file-cell')!)
    expect(document.querySelector('.lb-meta')!.textContent).toMatch(/1920×1080/)
  })

  it('omits dimensions from the lightbox when unknown', async () => {
    const files = [makeFile({ filename: '1700000000000-a1-1.jpg', width: null, height: null })]
    getImages.mockResolvedValue({ total: 1, limit: 50, offset: 0, images: files })
    await mount()
    await flushPromises()

    await fireEvent.click(document.querySelector('.file-cell')!)
    expect(document.querySelector('.lb-meta')!.textContent).not.toContain('×')
  })

  it('uses the original filename as the download button title when available', async () => {
    const files = [makeFile({ filename: '1700000000000-a1-1.jpg', originalName: 'plage été.jpg' })]
    getImages.mockResolvedValue({ total: 1, limit: 50, offset: 0, images: files })
    await mount()
    await flushPromises()

    await fireEvent.click(document.querySelector('.file-cell')!)
    expect(screen.getByTitle('plage été.jpg')).toBeTruthy()
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

  it('copies via ClipboardItem when available — the Safari-safe path', async () => {
    // Sur Safari, clipboard.write() doit être appelé de façon synchrone dans le
    // geste utilisateur pour être autorisé — passer une Promise comme donnée du
    // ClipboardItem permet de résoudre le lien créé côté serveur après coup sans
    // perdre cette autorisation. C'est ce chemin qu'on vérifie ici.
    const files = [makeFile({ filename: '1700000000000-a1-report.pdf', fileType: 'document' })]
    getImages.mockResolvedValue({ total: 1, limit: 50, offset: 0, images: files })
    createShareLink.mockResolvedValue({ url: '/share/xyz', expiresAt: 123 })

    class FakeClipboardItem {
      data: Record<string, Promise<Blob> | Blob | string>
      constructor(data: Record<string, Promise<Blob> | Blob | string>) { this.data = data }
    }
    const writeMock = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('ClipboardItem', FakeClipboardItem)
    Object.defineProperty(navigator, 'clipboard', {
      value: { write: writeMock, writeText: vi.fn() },
      configurable: true,
    })

    await mount()
    await flushPromises()

    await fireEvent.click(screen.getByTitle('Partager'))
    await flushPromises()

    expect(writeMock).toHaveBeenCalledTimes(1)
    const [item] = writeMock.mock.calls[0][0] as [FakeClipboardItem]
    const blob = await (item.data['text/plain'] as Promise<Blob>)
    expect(await blob.text()).toBe(`${window.location.origin}/share/xyz`)
    await waitFor(() => expect(screen.getByText('Lien copié !')).toBeTruthy())
  })

  it('renames a file and displays the custom name afterwards', async () => {
    const files = [makeFile({ filename: '1700000000000-a1-report.pdf', fileType: 'document' })]
    getImages.mockResolvedValue({ total: 1, limit: 50, offset: 0, images: files })
    renameFile.mockResolvedValue({ displayName: 'Facture juillet' })
    await mount()
    await flushPromises()

    await fireEvent.click(screen.getByTitle('Renommer'))
    const input = document.querySelector('.rename-input') as HTMLInputElement
    await fireEvent.update(input, 'Facture juillet')
    await fireEvent.click(screen.getByText('Enregistrer'))
    await flushPromises()

    expect(renameFile).toHaveBeenCalledWith(files[0].filename, 'Facture juillet')
    expect(screen.getByText('Facture juillet')).toBeTruthy()
  })

  it('calls downloadFile when clicking the download button', async () => {
    const files = [makeFile({ filename: '1700000000000-a1-report.pdf', fileType: 'document' })]
    getImages.mockResolvedValue({ total: 1, limit: 50, offset: 0, images: files })
    await mount()
    await flushPromises()

    await fireEvent.click(screen.getByTitle(files[0].filename))
    expect(downloadFile).toHaveBeenCalledWith(files[0].filename, files[0].url)
  })

  describe('selection and bulk delete', () => {
    it('shows a floating selection bar reachable without scrolling, and deletes the selection', async () => {
      const files = [
        makeFile({ filename: '1700000000000-a1-1.jpg' }),
        makeFile({ filename: '1700000000000-b2-2.jpg' }),
      ]
      getImages.mockResolvedValue({ total: 2, limit: 50, offset: 0, images: files })
      deleteImages.mockResolvedValue({ deleted: [files[0].filename], errors: [] })
      await mount()
      await flushPromises()

      expect(document.querySelector('.selection-bar')).toBeNull()
      await fireEvent.click(document.querySelector('.cell-checkbox')!)
      expect(screen.getByText('1 sélectionné')).toBeTruthy()

      getImages.mockResolvedValueOnce({ total: 1, limit: 50, offset: 0, images: [files[1]] })
      await fireEvent.click(screen.getByText('Supprimer'))
      await fireEvent.click(document.querySelector('.btn-danger')!)
      await flushPromises()

      expect(deleteImages).toHaveBeenCalledWith([files[0].filename])
      expect(document.querySelector('.selection-bar')).toBeNull()
    })

    it('clears the selection from the floating bar without deleting anything', async () => {
      const files = [makeFile({ filename: '1700000000000-a1-1.jpg' })]
      getImages.mockResolvedValue({ total: 1, limit: 50, offset: 0, images: files })
      await mount()
      await flushPromises()

      await fireEvent.click(document.querySelector('.cell-checkbox')!)
      expect(document.querySelector('.selection-bar')).toBeTruthy()

      await fireEvent.click(screen.getByTitle('Annuler la sélection'))
      expect(document.querySelector('.selection-bar')).toBeNull()
      expect(deleteImages).not.toHaveBeenCalled()
    })
  })

  describe('media viewer (video/audio/pdf/unsupported)', () => {
    it('opens a video in a <video> element', async () => {
      const files = [makeFile({ filename: '1700000000000-a1-clip.mp4', fileType: 'video' })]
      getImages.mockResolvedValue({ total: 1, limit: 50, offset: 0, images: files })
      await mount()
      await flushPromises()

      await fireEvent.click(document.querySelector('.doc-item')!)
      const video = document.querySelector('.lb-media')
      expect(video?.tagName).toBe('VIDEO')
      expect(video?.getAttribute('src')).toBe(files[0].url)
    })

    it('opens audio in an <audio> element', async () => {
      const files = [makeFile({ filename: '1700000000000-a1-song.mp3', fileType: 'audio' })]
      getImages.mockResolvedValue({ total: 1, limit: 50, offset: 0, images: files })
      await mount()
      await flushPromises()

      await fireEvent.click(document.querySelector('.doc-item')!)
      expect(document.querySelector('.lb-audio')?.tagName).toBe('AUDIO')
    })

    it('opens a PDF in an iframe', async () => {
      const files = [makeFile({ filename: '1700000000000-a1-report.pdf', fileType: 'document' })]
      getImages.mockResolvedValue({ total: 1, limit: 50, offset: 0, images: files })
      await mount()
      await flushPromises()

      await fireEvent.click(document.querySelector('.doc-item')!)
      expect(document.querySelector('.lb-pdf')?.tagName).toBe('IFRAME')
    })

    it('falls back to a download prompt for unsupported types', async () => {
      const files = [makeFile({ filename: '1700000000000-a1-archive.zip', fileType: 'archive' })]
      getImages.mockResolvedValue({ total: 1, limit: 50, offset: 0, images: files })
      await mount()
      await flushPromises()

      await fireEvent.click(document.querySelector('.doc-item')!)
      expect(document.querySelector('.lb-unsupported')).toBeTruthy()

      await fireEvent.click(screen.getByText('Télécharger'))
      expect(downloadFile).toHaveBeenCalledWith(files[0].filename, files[0].url)
    })

    it('shows the file size and name in the media viewer info bar', async () => {
      const files = [makeFile({ filename: '1700000000000-a1-song.mp3', fileType: 'audio', size: 3 * 1024 * 1024 })]
      getImages.mockResolvedValue({ total: 1, limit: 50, offset: 0, images: files })
      await mount()
      await flushPromises()

      await fireEvent.click(document.querySelector('.doc-item')!)
      expect(document.querySelector('.lb-meta')!.textContent).toMatch(/3\.0 Mo/)
    })
  })

  describe('refresh', () => {
    it('refetches the list when the refresh button is clicked', async () => {
      const files = [makeFile({ filename: '1700000000000-a1-1.jpg' })]
      getImages.mockResolvedValue({ total: 1, limit: 50, offset: 0, images: files })
      await mount()
      await flushPromises()
      expect(getImages).toHaveBeenCalledTimes(1)

      await fireEvent.click(screen.getByTitle('Rafraîchir'))
      await flushPromises()
      expect(getImages).toHaveBeenCalledTimes(2)
    })

    it('refetches automatically when the window regains focus', async () => {
      getImages.mockResolvedValue({ total: 0, limit: 50, offset: 0, images: [] })
      await mount()
      await flushPromises()
      expect(getImages).toHaveBeenCalledTimes(1)

      window.dispatchEvent(new Event('focus'))
      await flushPromises()
      expect(getImages).toHaveBeenCalledTimes(2)
    })

    it('does not auto-refresh while files are selected, to avoid disrupting the selection', async () => {
      const files = [makeFile({ filename: '1700000000000-a1-1.jpg' })]
      getImages.mockResolvedValue({ total: 1, limit: 50, offset: 0, images: files })
      await mount()
      await flushPromises()
      await fireEvent.click(document.querySelector('.cell-checkbox')!)
      expect(getImages).toHaveBeenCalledTimes(1)

      window.dispatchEvent(new Event('focus'))
      await flushPromises()
      expect(getImages).toHaveBeenCalledTimes(1)
    })
  })

  describe('remaining coverage: secondary buttons, error paths, swipe, day labels', () => {
    it('sorts files by size', async () => {
      const files = [
        makeFile({ filename: '1700000000000-a1-small.pdf', fileType: 'document', size: 100 }),
        makeFile({ filename: '1700000000000-b2-big.pdf', fileType: 'document', size: 9999 }),
      ]
      getImages.mockResolvedValue({ total: 2, limit: 50, offset: 0, images: files })
      await mount()
      await flushPromises()

      await fireEvent.update(screen.getByDisplayValue('Date'), 'size')
      const names = [...document.querySelectorAll('.doc-name')].map(n => n.textContent)
      expect(names).toEqual(['big', 'small'])
    })

    it('clears the search query via the clear button', async () => {
      const files = [makeFile({ filename: '1700000000000-a1-holiday.jpg', fileType: 'document' })]
      getImages.mockResolvedValue({ total: 1, limit: 50, offset: 0, images: files })
      await mount()
      await flushPromises()

      const input = screen.getByPlaceholderText('Rechercher…') as HTMLInputElement
      await fireEvent.update(input, 'nothing-matches')
      expect(document.querySelectorAll('.doc-item, .file-cell').length).toBe(0)

      await fireEvent.click(screen.getByText('✕'))
      expect(input.value).toBe('')
      expect(document.querySelectorAll('.doc-item, .file-cell').length).toBe(1)
    })

    it('selects a document via its own checkbox', async () => {
      const files = [makeFile({ filename: '1700000000000-a1-report.pdf', fileType: 'document' })]
      getImages.mockResolvedValue({ total: 1, limit: 50, offset: 0, images: files })
      await mount()
      await flushPromises()

      await fireEvent.click(document.querySelector('.doc-checkbox')!)
      expect(screen.getByText('1 sélectionné')).toBeTruthy()
    })

    it('navigates back to the previous image in the lightbox', async () => {
      const files = [
        makeFile({ filename: '1700000000000-a1-1.jpg' }),
        makeFile({ filename: '1700000000000-b2-2.jpg' }),
      ]
      getImages.mockResolvedValue({ total: 2, limit: 50, offset: 0, images: files })
      await mount()
      await flushPromises()

      await fireEvent.click(document.querySelectorAll('.file-cell')[0])
      await fireEvent.click(document.querySelector('.lb-next')!)
      expect(screen.getByText('2 / 2')).toBeTruthy()

      await fireEvent.click(document.querySelector('.lb-prev')!)
      expect(screen.getByText('1 / 2')).toBeTruthy()
    })

    it('opens rename, share and download from the image lightbox itself', async () => {
      const files = [makeFile({ filename: '1700000000000-a1-1.jpg' })]
      getImages.mockResolvedValue({ total: 1, limit: 50, offset: 0, images: files })
      renameFile.mockResolvedValue({ displayName: 'Photo' })
      createShareLink.mockResolvedValue({ url: '/share/xyz', expiresAt: 123 })
      await mount()
      await flushPromises()

      await fireEvent.click(document.querySelector('.file-cell')!)

      await fireEvent.click(screen.getByTitle('Renommer'))
      expect(document.querySelector('.rename-input')).toBeTruthy()
      await fireEvent.click(screen.getByText('Annuler'))

      await fireEvent.click(screen.getByTitle('Partager'))
      await flushPromises()
      expect(createShareLink).toHaveBeenCalledWith(files[0].filename)

      await fireEvent.click(screen.getByTitle(files[0].filename))
      expect(downloadFile).toHaveBeenCalledWith(files[0].filename, files[0].url)
    })

    it('closes the media viewer with the close button', async () => {
      const files = [makeFile({ filename: '1700000000000-a1-clip.mp4', fileType: 'video' })]
      getImages.mockResolvedValue({ total: 1, limit: 50, offset: 0, images: files })
      await mount()
      await flushPromises()

      await fireEvent.click(document.querySelector('.doc-item')!)
      expect(document.querySelector('.lightbox')).toBeTruthy()

      await fireEvent.click(document.querySelector('.lb-close')!)
      expect(document.querySelector('.lightbox')).toBeNull()
    })

    it('cancels the bulk-delete confirmation without deleting', async () => {
      const files = [makeFile({ filename: '1700000000000-a1-1.jpg' })]
      getImages.mockResolvedValue({ total: 1, limit: 50, offset: 0, images: files })
      await mount()
      await flushPromises()

      await fireEvent.click(document.querySelector('.cell-checkbox')!)
      await fireEvent.click(screen.getByText('Supprimer'))
      await fireEvent.click(screen.getByText('Annuler'))

      expect(document.querySelector('.dialog-overlay')).toBeNull()
      expect(deleteImages).not.toHaveBeenCalled()
    })

    it('cancels the rename dialog without saving', async () => {
      const files = [makeFile({ filename: '1700000000000-a1-report.pdf', fileType: 'document' })]
      getImages.mockResolvedValue({ total: 1, limit: 50, offset: 0, images: files })
      await mount()
      await flushPromises()

      await fireEvent.click(screen.getByTitle('Renommer'))
      await fireEvent.click(screen.getByText('Annuler'))

      expect(document.querySelector('.rename-input')).toBeNull()
      expect(renameFile).not.toHaveBeenCalled()
    })

    it('shows an error message when renaming fails', async () => {
      const files = [makeFile({ filename: '1700000000000-a1-report.pdf', fileType: 'document' })]
      getImages.mockResolvedValue({ total: 1, limit: 50, offset: 0, images: files })
      renameFile.mockRejectedValue(new Error('Erreur renommage'))
      await mount()
      await flushPromises()

      await fireEvent.click(screen.getByTitle('Renommer'))
      await fireEvent.click(screen.getByText('Enregistrer'))
      await flushPromises()

      expect(screen.getByRole('alert').textContent).toMatch(/Erreur renommage/)
    })

    it('shows an error message when the bulk delete fails', async () => {
      const files = [makeFile({ filename: '1700000000000-a1-1.jpg' })]
      getImages.mockResolvedValue({ total: 1, limit: 50, offset: 0, images: files })
      deleteImages.mockRejectedValue(new Error('Erreur suppression'))
      await mount()
      await flushPromises()

      await fireEvent.click(document.querySelector('.cell-checkbox')!)
      await fireEvent.click(screen.getByText('Supprimer'))
      await fireEvent.click(document.querySelector('.btn-danger')!)
      await flushPromises()

      expect(screen.getByText('Erreur suppression')).toBeTruthy()
    })

    it('shows an error toast when sharing fails', async () => {
      const files = [makeFile({ filename: '1700000000000-a1-report.pdf', fileType: 'document' })]
      getImages.mockResolvedValue({ total: 1, limit: 50, offset: 0, images: files })
      createShareLink.mockRejectedValue(new Error('network down'))
      await mount()
      await flushPromises()

      await fireEvent.click(screen.getByTitle('Partager'))
      await flushPromises()

      await waitFor(() => expect(screen.getByText('Erreur de partage')).toBeTruthy())
    })

    it('shows an error message when the manual refresh fails', async () => {
      getImages.mockResolvedValueOnce({ total: 0, limit: 50, offset: 0, images: [] })
      await mount()
      await flushPromises()

      getImages.mockRejectedValueOnce(new Error('Erreur chargement fichiers'))
      await fireEvent.click(screen.getByTitle('Rafraîchir'))
      await flushPromises()

      expect(screen.getByText('Erreur chargement fichiers')).toBeTruthy()
    })

    it('auto-refreshes when the tab becomes visible again', async () => {
      getImages.mockResolvedValue({ total: 0, limit: 50, offset: 0, images: [] })
      await mount()
      await flushPromises()
      expect(getImages).toHaveBeenCalledTimes(1)

      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
      await flushPromises()

      expect(getImages).toHaveBeenCalledTimes(2)
    })

    it('does not auto-refresh when the tab becomes hidden', async () => {
      getImages.mockResolvedValue({ total: 0, limit: 50, offset: 0, images: [] })
      await mount()
      await flushPromises()
      expect(getImages).toHaveBeenCalledTimes(1)

      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
      await flushPromises()

      expect(getImages).toHaveBeenCalledTimes(1)
    })

    it('swipes left/right to navigate the lightbox, ignoring small movements', async () => {
      const files = [
        makeFile({ filename: '1700000000000-a1-1.jpg' }),
        makeFile({ filename: '1700000000000-b2-2.jpg' }),
      ]
      getImages.mockResolvedValue({ total: 2, limit: 50, offset: 0, images: files })
      await mount()
      await flushPromises()

      await fireEvent.click(document.querySelectorAll('.file-cell')[0])
      const lb = document.querySelector('.lightbox')!

      // Petit mouvement (< 50px) — ignoré, on reste sur la même image.
      await fireEvent.touchStart(lb, { changedTouches: [{ clientX: 200 }] })
      await fireEvent.touchEnd(lb, { changedTouches: [{ clientX: 190 }] })
      expect(screen.getByText('1 / 2')).toBeTruthy()

      // Swipe vers la gauche — image suivante.
      await fireEvent.touchStart(lb, { changedTouches: [{ clientX: 200 }] })
      await fireEvent.touchEnd(lb, { changedTouches: [{ clientX: 100 }] })
      expect(screen.getByText('2 / 2')).toBeTruthy()

      // Swipe vers la droite — image précédente.
      await fireEvent.touchStart(lb, { changedTouches: [{ clientX: 100 }] })
      await fireEvent.touchEnd(lb, { changedTouches: [{ clientX: 200 }] })
      expect(screen.getByText('1 / 2')).toBeTruthy()
    })

    it('closes the image lightbox when clicking the backdrop itself', async () => {
      const files = [makeFile({ filename: '1700000000000-a1-1.jpg' })]
      getImages.mockResolvedValue({ total: 1, limit: 50, offset: 0, images: files })
      await mount()
      await flushPromises()

      await fireEvent.click(document.querySelector('.file-cell')!)
      const lb = document.querySelector('.lightbox')!
      await fireEvent.click(lb) // le backdrop lui-même, pas un enfant (image/boutons)
      expect(document.querySelector('.lightbox')).toBeNull()
    })

    it('opens rename, share and download from inside the media viewer itself', async () => {
      // Le doc-item a ses propres boutons Renommer/Partager identiques dans la
      // liste — ceux-ci sont distincts et vérifiés séparément par ailleurs. Ici
      // on cible spécifiquement ceux du lecteur média une fois ouvert.
      const files = [makeFile({ filename: '1700000000000-a1-clip.mp4', fileType: 'video' })]
      getImages.mockResolvedValue({ total: 1, limit: 50, offset: 0, images: files })
      renameFile.mockResolvedValue({ displayName: 'Vidéo' })
      createShareLink.mockResolvedValue({ url: '/share/xyz', expiresAt: 123 })
      await mount()
      await flushPromises()

      await fireEvent.click(document.querySelector('.doc-item')!)
      const viewer = within(document.querySelector('.lightbox')!)

      await fireEvent.click(viewer.getByTitle('Renommer'))
      expect(document.querySelector('.rename-input')).toBeTruthy()
      await fireEvent.click(screen.getByText('Annuler'))

      await fireEvent.click(viewer.getByTitle('Partager'))
      await flushPromises()
      expect(createShareLink).toHaveBeenCalledWith(files[0].filename)

      const downloadBtn = document.querySelector('.lightbox .lb-actions .lb-dl:last-child')!
      await fireEvent.click(downloadBtn)
      expect(downloadFile).toHaveBeenCalledWith(files[0].filename, files[0].url)
    })

    it('closes the media viewer when clicking the backdrop itself', async () => {
      const files = [makeFile({ filename: '1700000000000-a1-clip.mp4', fileType: 'video' })]
      getImages.mockResolvedValue({ total: 1, limit: 50, offset: 0, images: files })
      await mount()
      await flushPromises()

      await fireEvent.click(document.querySelector('.doc-item')!)
      const lb = document.querySelector('.lightbox')!
      await fireEvent.click(lb)
      expect(document.querySelector('.lightbox')).toBeNull()
    })

    it('closes the delete confirmation when clicking the backdrop itself', async () => {
      const files = [makeFile({ filename: '1700000000000-a1-1.jpg' })]
      getImages.mockResolvedValue({ total: 1, limit: 50, offset: 0, images: files })
      await mount()
      await flushPromises()

      await fireEvent.click(document.querySelector('.cell-checkbox')!)
      await fireEvent.click(screen.getByText('Supprimer'))
      const overlay = document.querySelector('.dialog-overlay')!
      await fireEvent.click(overlay)

      expect(document.querySelector('.dialog-overlay')).toBeNull()
      expect(deleteImages).not.toHaveBeenCalled()
    })

    it('closes the rename dialog when clicking the backdrop itself', async () => {
      const files = [makeFile({ filename: '1700000000000-a1-report.pdf', fileType: 'document' })]
      getImages.mockResolvedValue({ total: 1, limit: 50, offset: 0, images: files })
      await mount()
      await flushPromises()

      await fireEvent.click(screen.getByTitle('Renommer'))
      const overlay = document.querySelector('.dialog-overlay')!
      await fireEvent.click(overlay)

      expect(document.querySelector('.rename-input')).toBeNull()
      expect(renameFile).not.toHaveBeenCalled()
    })

    it('labels yesterday\'s and older groups correctly', async () => {
      const now = new Date()
      const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
      const lastWeek = new Date(now); lastWeek.setDate(now.getDate() - 10)

      const files = [
        makeFile({ filename: '1700000000001-a1-1.jpg', fileType: 'document', uploadedAt: yesterday.getTime() }),
        makeFile({ filename: '1700000000002-b2-2.jpg', fileType: 'document', uploadedAt: lastWeek.getTime() }),
      ]
      getImages.mockResolvedValue({ total: 2, limit: 50, offset: 0, images: files })
      await mount()
      await flushPromises()

      expect(screen.getByText('Hier')).toBeTruthy()
      const expected = lastWeek.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      expect(screen.getByText(expected)).toBeTruthy()
    })
  })
})
