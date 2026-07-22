<template>
  <div class="files-page">
    <header class="page-header">
      <h1 class="page-title">Fichiers</h1>
      <div class="header-actions">
        <select v-if="selected.size === 0" v-model="sortKey" class="sort-select">
          <option value="date">Date</option>
          <option value="name">Nom</option>
          <option value="size">Taille</option>
        </select>
      </div>
      <div class="header-actions" v-if="selected.size > 0">
        <button class="btn-delete-sel" @click="showConfirm = true">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          </svg>
          {{ selected.size }}
        </button>
        <button class="btn-cancel-sel" @click="selected = new Set()">✕</button>
      </div>
    </header>

    <!-- Search + Filter bar -->
    <div class="search-bar">
      <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input v-model="searchQuery" class="search-input" type="text"
        placeholder="Rechercher…" autocomplete="off" />
      <button v-if="searchQuery" class="search-clear" @click="searchQuery = ''">✕</button>
    </div>
    <div class="filter-bar">
      <button
        v-for="f in FILTERS"
        :key="f.key"
        class="chip"
        :class="{ 'chip--active': activeFilter === f.key }"
        @click="activeFilter = f.key"
      >
        <span>{{ f.label }}</span>
        <span v-if="f.key !== 'all' && counts[f.key]" class="chip-count">{{ counts[f.key] }}</span>
      </button>
    </div>

    <!-- States -->
    <div v-if="loading" class="state-center"><div class="spinner-lg"></div></div>
    <div v-else-if="error" class="state-center state-error">{{ error }}</div>
    <div v-else-if="groups.length === 0" class="state-center state-empty">
      <p>Aucun fichier{{ activeFilter !== 'all' ? ' dans cette catégorie' : '' }}.</p>
      <RouterLink v-if="activeFilter === 'all'" to="/upload" class="btn-add-first">
        Ajouter un fichier
      </RouterLink>
    </div>

    <!-- Timeline -->
    <div v-else class="timeline">
      <div v-for="group in groups" :key="group.label" class="day-group">
        <div v-if="group.label" class="day-label">
          <span class="day-text">{{ group.label }}</span>
          <span class="day-count">{{ group.files.length }}</span>
        </div>

        <!-- Image grid for groups with images -->
        <div v-if="hasImages(group)" class="image-grid">
          <template v-for="f in group.files" :key="f.filename">
            <div v-if="f.fileType === 'image'"
              class="file-cell"
              :class="{ 'file-cell--selected': selected.has(f.filename) }"
              @click="onCellClick(f)"
            >
              <img :src="mediaUrl(f.url)" :alt="displayNameOf(f)" loading="lazy" />
              <div class="cell-checkbox" @click.stop="toggleSelect(f.filename)">
                <div class="checkbox" :class="{ checked: selected.has(f.filename) }">
                  <svg v-if="selected.has(f.filename)" xmlns="http://www.w3.org/2000/svg"
                    width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white"
                    stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- Doc list for non-image files -->
        <div class="doc-list">
          <template v-for="f in group.files" :key="f.filename">
            <div v-if="f.fileType !== 'image'"
              class="doc-item"
              :class="{ 'doc-item--selected': selected.has(f.filename) }"
              @click="onDocClick(f)"
            >
              <div class="doc-icon" :class="`doc-icon--${f.fileType}`">{{ typeIcon(f.fileType) }}</div>
              <div class="doc-info">
                <span class="doc-name">{{ displayNameOf(f) }}</span>
                <span class="doc-meta">{{ ext(f.filename) }} · {{ formatSize(f.size) }}</span>
              </div>
              <button class="doc-dl" title="Renommer" @click.stop="openRename(f)">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                </svg>
              </button>
              <button class="doc-dl" title="Partager" @click.stop="shareFile(f)">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
              </button>
              <button class="doc-dl" :title="f.filename"
                @click.stop="downloadFile(f.filename, f.url)">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/>
                  <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/>
                </svg>
              </button>
              <div class="doc-checkbox" @click.stop="toggleSelect(f.filename)">
                <div class="checkbox" :class="{ checked: selected.has(f.filename) }">
                  <svg v-if="selected.has(f.filename)" xmlns="http://www.w3.org/2000/svg"
                    width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white"
                    stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>

      <div v-if="hasMore" class="load-more-wrap">
        <button class="btn-load-more" :disabled="loadingMore" @click="loadMore">
          <span v-if="loadingMore" class="spinner-sm"></span>
          {{ loadingMore ? 'Chargement…' : `Charger plus (${total - allFiles.length} restants)` }}
        </button>
      </div>
    </div>

    <!-- Lightbox (images only) -->
    <Teleport to="body">
      <div v-if="lightbox" class="lightbox" @click.self="lightbox = null"
        @touchstart.passive="onTouchStart" @touchend.passive="onTouchEnd">
        <button class="lb-close" @click="lightbox = null">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        <button v-if="lightboxIndex > 0" class="lb-nav lb-prev" @click="navLightbox(-1)">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <img :src="mediaUrl(lightbox.url)" :alt="displayNameOf(lightbox)" class="lb-img" />
        <button v-if="lightboxIndex < imageFiles.length - 1" class="lb-nav lb-next" @click="navLightbox(1)">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
        <div class="lb-info">
          <span class="lb-date">{{ formatDateTime(lightbox.uploadedAt) }}</span>
          <span class="lb-counter">{{ lightboxIndex + 1 }} / {{ imageFiles.length }}</span>
          <button class="lb-dl" title="Renommer" @click="openRename(lightbox)">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>
            </svg>
          </button>
          <button class="lb-dl" title="Partager" @click="shareFile(lightbox)">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
          </button>
          <button class="lb-dl" :title="lightbox.filename" @click="downloadFile(lightbox.filename, lightbox.url)">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/>
              <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/>
            </svg>
          </button>
        </div>
      </div>
    </Teleport>

    <!-- Media viewer (vidéo, audio, PDF) -->
    <Teleport to="body">
      <div v-if="mediaFile" class="lightbox" @click.self="mediaFile = null">
        <button class="lb-close" @click="mediaFile = null">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        <video v-if="mediaFile.fileType === 'video'" :src="mediaUrl(mediaFile.url)"
          class="lb-media" controls autoplay />
        <audio v-else-if="mediaFile.fileType === 'audio'" :src="mediaUrl(mediaFile.url)"
          class="lb-audio" controls autoplay />
        <iframe v-else-if="mediaFile.fileType === 'document' && mediaFile.filename.endsWith('.pdf')"
          :src="mediaUrl(mediaFile.url)" class="lb-pdf" />
        <div v-else class="lb-unsupported">
          <p>{{ displayNameOf(mediaFile) }}</p>
          <button class="btn-dl-big" @click="downloadFile(mediaFile.filename, mediaFile.url)">
            Télécharger
          </button>
        </div>
        <div class="lb-info">
          <span class="lb-date">{{ displayNameOf(mediaFile) }}</span>
          <span class="lb-counter">{{ formatSize(mediaFile.size) }}</span>
          <button class="lb-dl" title="Renommer" @click="openRename(mediaFile)">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>
            </svg>
          </button>
          <button class="lb-dl" title="Partager" @click="shareFile(mediaFile)">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
          </button>
          <button class="lb-dl" @click="downloadFile(mediaFile.filename, mediaFile.url)">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/>
              <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/>
            </svg>
          </button>
        </div>
      </div>
    </Teleport>

    <!-- Delete confirm -->
    <Teleport to="body">
      <div v-if="showConfirm" class="dialog-overlay" @click.self="showConfirm = false">
        <div class="dialog">
          <h3 class="dialog-title">Supprimer {{ selected.size }} fichier{{ selected.size > 1 ? 's' : '' }} ?</h3>
          <p class="dialog-sub">Cette action est irréversible.</p>
          <div class="dialog-actions">
            <button class="btn-danger" :disabled="deleting" @click="doDelete">
              <span v-if="deleting" class="spinner-sm"></span>
              {{ deleting ? 'Suppression…' : 'Supprimer' }}
            </button>
            <button class="btn-ghost" @click="showConfirm = false">Annuler</button>
          </div>
        </div>
      </div>
    </Teleport>
    <!-- Rename dialog -->
    <Teleport to="body">
      <div v-if="renameTarget" class="dialog-overlay" @click.self="renameTarget = null">
        <div class="dialog">
          <h3 class="dialog-title">Renommer</h3>
          <input
            v-model="renameValue"
            class="rename-input"
            type="text"
            maxlength="200"
            :disabled="renaming"
            @keyup.enter="doRename"
          />
          <p v-if="renameError" class="error-msg" role="alert">{{ renameError }}</p>
          <div class="dialog-actions">
            <button class="btn-save" :disabled="renaming" @click="doRename">
              <span v-if="renaming" class="spinner-sm"></span>
              {{ renaming ? 'Enregistrement…' : 'Enregistrer' }}
            </button>
            <button class="btn-ghost" @click="renameTarget = null">Annuler</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Copy toast -->
    <Teleport to="body">
      <div v-if="copyToast" class="copy-toast">{{ copyToast }}</div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useApi } from '../composables/useApi'
import type { FileEntry, FileType } from '../types'

const { getImages, deleteImages, downloadFile, createShareLink, mediaUrl, renameFile } = useApi()

const LIMIT = 50

type FilterKey = 'all' | FileType

interface Filter { key: FilterKey; label: string }
interface DayGroup { label: string; files: FileEntry[] }

const FILTERS: Filter[] = [
  { key: 'all',      label: 'Tout'      },
  { key: 'image',    label: 'Images'    },
  { key: 'video',    label: 'Vidéos'    },
  { key: 'audio',    label: 'Audio'     },
  { key: 'document', label: 'Documents' },
  { key: 'other',    label: 'Autres'    },
]

const TYPE_ICONS: Record<FileType, string> = {
  image: '🖼️', video: '🎬', audio: '🎵', document: '📄', archive: '📦', other: '📎',
}

type SortKey = 'date' | 'name' | 'size'

const allFiles      = ref<FileEntry[]>([])
const total         = ref(0)
const loading       = ref(true)
const loadingMore   = ref(false)
const error         = ref('')
const activeFilter  = ref<FilterKey>('all')
const searchQuery   = ref('')
const sortKey       = ref<SortKey>('date')
const selected      = ref<Set<string>>(new Set())
const lightbox      = ref<FileEntry | null>(null)
const lightboxIndex = ref(0)
const mediaFile     = ref<FileEntry | null>(null)
const showConfirm   = ref(false)
const deleting      = ref(false)
const copyToast     = ref('')
const renameTarget  = ref<FileEntry | null>(null)
const renameValue   = ref('')
const renaming      = ref(false)
const renameError   = ref('')

const hasMore    = computed(() => allFiles.value.length < total.value)
const imageFiles = computed(() => allFiles.value.filter(f => f.fileType === 'image'))
const counts     = computed((): Record<string, number> => {
  const c: Record<string, number> = {}
  for (const f of allFiles.value) c[f.fileType] = (c[f.fileType] ?? 0) + 1
  return c
})

const filteredFiles = computed(() => {
  let files = activeFilter.value === 'all'
    ? allFiles.value
    : allFiles.value.filter(f => f.fileType === activeFilter.value)
  const q = searchQuery.value.trim().toLowerCase()
  if (q) files = files.filter(f => cleanName(f.filename).toLowerCase().includes(q) || f.filename.toLowerCase().includes(q))
  const sorted = [...files]
  if (sortKey.value === 'name') sorted.sort((a, b) => cleanName(a.filename).localeCompare(cleanName(b.filename), 'fr'))
  else if (sortKey.value === 'size') sorted.sort((a, b) => b.size - a.size)
  // 'date' keeps the API order (newest first)
  return sorted
})

const groups = computed((): DayGroup[] => {
  if (sortKey.value !== 'date') {
    return [{ label: '', files: filteredFiles.value }]
  }
  const map = new Map<string, DayGroup>()
  for (const f of filteredFiles.value) {
    const key = dayKey(f.uploadedAt)
    if (!map.has(key)) map.set(key, { label: dayLabel(f.uploadedAt), files: [] })
    map.get(key)!.files.push(f)
  }
  return [...map.values()]
})

function hasImages(group: DayGroup): boolean {
  return group.files.some(f => f.fileType === 'image')
}

async function fetchFiles(offset = 0): Promise<void> {
  const data = await getImages(LIMIT, offset)
  total.value = data.total
  if (offset === 0) allFiles.value = data.images
  else allFiles.value.push(...data.images)
}

async function loadMore(): Promise<void> {
  loadingMore.value = true
  try { await fetchFiles(allFiles.value.length) }
  finally { loadingMore.value = false }
}

function onCellClick(f: FileEntry): void {
  if (selected.value.size > 0) { toggleSelect(f.filename); return }
  lightboxIndex.value = imageFiles.value.findIndex(i => i.filename === f.filename)
  lightbox.value = f
}

function onDocClick(f: FileEntry): void {
  if (selected.value.size > 0) { toggleSelect(f.filename); return }
  mediaFile.value = f
}

function toggleSelect(filename: string): void {
  const s = new Set(selected.value)
  s.has(filename) ? s.delete(filename) : s.add(filename)
  selected.value = s
}

function navLightbox(dir: number): void {
  const idx = lightboxIndex.value + dir
  if (idx < 0 || idx >= imageFiles.value.length) return
  lightboxIndex.value = idx
  lightbox.value = imageFiles.value[idx]
}

async function doDelete(): Promise<void> {
  deleting.value = true
  try {
    await deleteImages([...selected.value])
    selected.value = new Set()
    showConfirm.value = false
    loading.value = true
    await fetchFiles(0)
  } catch (e) { error.value = (e as Error).message }
  finally { deleting.value = false; loading.value = false }
}

function typeIcon(t: string): string { return TYPE_ICONS[t as FileType] ?? '📎' }
function ext(filename: string): string { return filename.split('.').pop()?.toUpperCase() ?? '' }
function cleanName(filename: string): string {
  const name = filename.replace(/^\d+-[a-f0-9]+-/, '').replace(/\.[^.]+$/, '')
  return name.length > 30 ? name.slice(0, 28) + '…' : name
}
function displayNameOf(f: FileEntry): string {
  return f.displayName || cleanName(f.filename)
}

function openRename(f: FileEntry): void {
  renameTarget.value = f
  renameValue.value = f.displayName ?? cleanName(f.filename)
  renameError.value = ''
}

async function doRename(): Promise<void> {
  if (!renameTarget.value || renaming.value) return
  renaming.value = true
  renameError.value = ''
  try {
    const { displayName } = await renameFile(renameTarget.value.filename, renameValue.value)
    renameTarget.value.displayName = displayName
    renameTarget.value = null
  } catch (e) {
    renameError.value = (e as Error).message
  } finally {
    renaming.value = false
  }
}
function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' o'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko'
  return (bytes / (1024 * 1024)).toFixed(1) + ' Mo'
}
function dayKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}
function dayLabel(ts: number): string {
  const d = new Date(ts)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (dayKey(d.getTime()) === dayKey(today.getTime())) return "Aujourd'hui"
  if (dayKey(d.getTime()) === dayKey(yesterday.getTime())) return 'Hier'
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

let copyToastTimer: ReturnType<typeof setTimeout> | null = null
async function shareFile(f: FileEntry): Promise<void> {
  try {
    const { url } = await createShareLink(f.filename)
    const fullUrl = `${window.location.origin}${url}`
    await navigator.clipboard.writeText(fullUrl)
    if (copyToastTimer) clearTimeout(copyToastTimer)
    copyToast.value = 'Lien copié !'
    copyToastTimer = setTimeout(() => { copyToast.value = '' }, 3000)
  } catch {
    copyToast.value = 'Erreur de partage'
    copyToastTimer = setTimeout(() => { copyToast.value = '' }, 3000)
  }
}

let touchStartX = 0
function onTouchStart(e: TouchEvent): void { touchStartX = e.changedTouches[0].clientX }
function onTouchEnd(e: TouchEvent): void {
  const dx = e.changedTouches[0].clientX - touchStartX
  if (Math.abs(dx) < 50) return
  navLightbox(dx < 0 ? 1 : -1)
}

function onKeyDown(e: KeyboardEvent): void {
  if (!lightbox.value) return
  if (e.key === 'ArrowRight') navLightbox(1)
  else if (e.key === 'ArrowLeft') navLightbox(-1)
  else if (e.key === 'Escape') lightbox.value = null
}

onMounted(async () => {
  try { await fetchFiles(0) }
  catch (e) { error.value = (e as Error).message }
  finally { loading.value = false }
  window.addEventListener('keydown', onKeyDown)
})
onUnmounted(() => { window.removeEventListener('keydown', onKeyDown) })
</script>

<style scoped>
.files-page {
  min-height: 100dvh;
  background: #0f172a;
  color: #f8fafc;
  padding-bottom: 5rem;
}

.page-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1.25rem 1.25rem .75rem;
}
.page-title { margin: 0; font-size: 1.25rem; font-weight: 700; letter-spacing: -.02em; }
.header-actions { display: flex; gap: .5rem; align-items: center; }

.sort-select {
  background: #1e293b; border: 1px solid rgba(255,255,255,.08); border-radius: .625rem;
  color: #94a3b8; font-size: .8125rem; font-family: inherit; padding: .375rem .625rem;
  cursor: pointer; outline: none;
}
.sort-select:focus { border-color: rgba(99,102,241,.4); }

/* Search bar */
.search-bar {
  position: relative; display: flex; align-items: center;
  margin: 0 1.25rem .375rem;
}
.search-icon {
  position: absolute; left: .75rem; color: #475569; pointer-events: none; flex-shrink: 0;
}
.search-input {
  width: 100%; background: #1e293b; border: 1px solid rgba(255,255,255,.07);
  border-radius: .75rem; color: #f8fafc; font-size: .9375rem; font-family: inherit;
  padding: .5625rem .75rem .5625rem 2.25rem; outline: none; transition: border-color .15s;
}
.search-input::placeholder { color: #475569; }
.search-input:focus { border-color: rgba(99,102,241,.4); }
.search-clear {
  position: absolute; right: .625rem; background: none; border: none; color: #475569;
  cursor: pointer; font-size: .875rem; padding: .25rem; line-height: 1; transition: color .15s;
}
.search-clear:hover { color: #94a3b8; }
.btn-delete-sel {
  display: flex; align-items: center; gap: .375rem; padding: .4375rem .875rem;
  background: rgba(239,68,68,.15); border: 1px solid rgba(239,68,68,.3);
  border-radius: .625rem; color: #f87171; font-size: .8125rem; font-family: inherit; cursor: pointer;
}
.btn-cancel-sel {
  padding: .4375rem .625rem; background: transparent; border: 1px solid rgba(255,255,255,.1);
  border-radius: .625rem; color: #475569; font-size: .875rem; font-family: inherit; cursor: pointer;
}

/* Filter bar */
.filter-bar {
  display: flex; gap: .5rem; padding: 0 1.25rem .875rem;
  overflow-x: auto; scrollbar-width: none;
}
.filter-bar::-webkit-scrollbar { display: none; }
.chip {
  display: flex; align-items: center; gap: .3125rem; padding: .4375rem .875rem;
  background: #1e293b; border: 1px solid rgba(255,255,255,.07); border-radius: 9999px;
  color: #64748b; font-size: .8125rem; font-family: inherit; cursor: pointer; white-space: nowrap;
  transition: color .15s, border-color .15s, background .15s;
  -webkit-tap-highlight-color: transparent;
}
.chip:hover { color: #94a3b8; border-color: rgba(255,255,255,.15); }
.chip--active { background: rgba(99,102,241,.15); border-color: rgba(99,102,241,.4); color: #a5b4fc; }
.chip-count {
  background: rgba(99,102,241,.2); color: #818cf8;
  border-radius: 9999px; padding: .0625rem .375rem; font-size: .6875rem; font-weight: 600;
}

/* States */
.state-center {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  min-height: 40vh; gap: .75rem; color: #475569; font-size: .9375rem;
}
.state-error { color: #f87171; }
.state-empty .empty-icon { font-size: 2.5rem; }
.state-empty p { margin: 0; }
.btn-add-first {
  display: inline-block; margin-top: .75rem; padding: .625rem 1.5rem;
  background: #6366f1; border-radius: 9999px; color: #fff;
  font-size: .9375rem; font-weight: 600; text-decoration: none;
  transition: background .15s;
}
.btn-add-first:hover { background: #4f46e5; }

.spinner-lg {
  width: 2rem; height: 2rem; border: 3px solid rgba(99,102,241,.2);
  border-top-color: #6366f1; border-radius: 50%; animation: spin .7s linear infinite;
}
.spinner-sm {
  display: inline-block; width: .875rem; height: .875rem;
  border: 2px solid rgba(255,255,255,.3); border-top-color: currentColor;
  border-radius: 50%; animation: spin .7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Timeline */
.timeline { padding: 0 1.25rem; display: flex; flex-direction: column; gap: 1.5rem; }
.day-group { display: flex; flex-direction: column; gap: .5rem; }
.day-label {
  display: flex; align-items: center; gap: .5rem;
  border-bottom: 1px solid rgba(255,255,255,.06); padding-bottom: .375rem;
}
.day-text { font-size: .8125rem; font-weight: 600; color: #94a3b8; text-transform: capitalize; }
.day-count {
  font-size: .6875rem; color: #334155;
  background: rgba(255,255,255,.05); border-radius: 9999px; padding: .0625rem .4rem;
}

/* Image grid */
.image-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: .25rem;
}
@media (min-width: 480px) { .image-grid { grid-template-columns: repeat(4, 1fr); } }
@media (min-width: 768px) { .image-grid { grid-template-columns: repeat(5, 1fr); } }

.file-cell {
  aspect-ratio: 1; overflow: hidden; border-radius: .375rem;
  background: #1e293b; cursor: pointer; position: relative;
  -webkit-tap-highlight-color: transparent;
}
.file-cell img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .2s; }
.file-cell:hover img { transform: scale(1.04); }
.file-cell--selected { outline: 2.5px solid #6366f1; outline-offset: -2.5px; }
.file-cell--selected img { opacity: .7; }

.cell-checkbox { position: absolute; top: .3rem; left: .3rem; padding: .2rem; }
.checkbox {
  width: 1.125rem; height: 1.125rem; border-radius: 50%;
  border: 2px solid rgba(255,255,255,.5); background: rgba(15,23,42,.5);
  display: flex; align-items: center; justify-content: center;
}
.checkbox.checked { border-color: #6366f1; background: #6366f1; }

/* Doc list */
.doc-list { display: flex; flex-direction: column; gap: .375rem; }
.doc-item {
  display: flex; align-items: center; gap: .875rem;
  padding: .75rem 1rem; background: #1e293b; border-radius: .625rem;
  cursor: pointer; border: 1px solid transparent; transition: border-color .15s;
  -webkit-tap-highlight-color: transparent;
}
.doc-item:hover { border-color: rgba(255,255,255,.07); }
.doc-item--selected { border-color: #6366f1; background: rgba(99,102,241,.08); }

.doc-icon {
  width: 2.5rem; height: 2.5rem; border-radius: .5rem; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; font-size: 1.25rem;
}
.doc-icon--video    { background: rgba(139,92,246,.15); }
.doc-icon--audio    { background: rgba(16,185,129,.15); }
.doc-icon--document { background: rgba(59,130,246,.15); }
.doc-icon--archive  { background: rgba(245,158,11,.15); }
.doc-icon--other    { background: rgba(100,116,139,.15); }

.doc-info { flex: 1; display: flex; flex-direction: column; gap: .125rem; min-width: 0; }
.doc-name { font-size: .875rem; font-weight: 500; color: #e2e8f0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.doc-meta { font-size: .75rem; color: #475569; }
.doc-dl {
  flex-shrink: 0; background: none; border: none; color: #475569; cursor: pointer;
  padding: .25rem; display: flex; align-items: center; border-radius: .375rem;
  transition: color .15s;
}
.doc-dl:hover { color: #94a3b8; }
.doc-checkbox { flex-shrink: 0; }

/* Load more */
.load-more-wrap { display: flex; justify-content: center; padding: .5rem 0 1rem; }
.btn-load-more {
  display: flex; align-items: center; gap: .5rem; padding: .625rem 1.5rem;
  background: #1e293b; border: 1px solid rgba(255,255,255,.08); border-radius: 9999px;
  color: #94a3b8; font-size: .875rem; font-family: inherit; cursor: pointer;
}
.btn-load-more:hover:not(:disabled) { background: #263348; }
.btn-load-more:disabled { opacity: .5; cursor: not-allowed; }

/* Lightbox */
.lightbox {
  position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,.92);
  backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; padding: 1rem;
}
.lb-img { max-width: 100%; max-height: 85dvh; border-radius: .5rem; object-fit: contain; }
.lb-close, .lb-nav {
  position: absolute; width: 2.5rem; height: 2.5rem;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,.1); border: none; border-radius: 50%;
  color: #fff; cursor: pointer; transition: background .2s;
}
.lb-close:hover, .lb-nav:hover { background: rgba(255,255,255,.2); }
.lb-close { top: 1rem; right: 1rem; }
.lb-prev { left: .75rem; top: 50%; transform: translateY(-50%); }
.lb-next { right: .75rem; top: 50%; transform: translateY(-50%); }
.lb-info {
  position: absolute; bottom: 1rem; left: 50%; transform: translateX(-50%);
  display: flex; gap: 1rem; background: rgba(0,0,0,.6); border-radius: 9999px; padding: .375rem .875rem;
}
.lb-date, .lb-counter { font-size: .75rem; color: #94a3b8; }

/* Media viewer */
.lb-media { max-width: 95vw; max-height: 80dvh; border-radius: .5rem; outline: none; }
.lb-audio { width: min(400px, 90vw); }
.lb-pdf { width: min(900px, 95vw); height: 85dvh; border: none; border-radius: .5rem; background: #fff; }
.lb-unsupported {
  display: flex; flex-direction: column; align-items: center; gap: 1rem;
  color: #94a3b8; font-size: .9375rem;
}
.copy-toast {
  position: fixed; bottom: 5.5rem; left: 50%; transform: translateX(-50%);
  background: #1e293b; border: 1px solid rgba(255,255,255,.12); border-radius: 9999px;
  color: #f8fafc; font-size: .875rem; font-weight: 500; padding: .5rem 1.25rem;
  z-index: 9999; pointer-events: none;
  animation: toast-in .2s ease;
}
@keyframes toast-in { from { opacity: 0; transform: translateX(-50%) translateY(.5rem); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }

.btn-dl-big {
  padding: .625rem 1.5rem; background: #6366f1; border: none; border-radius: .75rem;
  color: #fff; font-size: .9375rem; font-weight: 600; font-family: inherit; cursor: pointer;
}
.lb-dl {
  background: none; border: none; color: #94a3b8; cursor: pointer; padding: 0;
  display: flex; align-items: center; transition: color .15s;
}
.lb-dl:hover { color: #f8fafc; }

/* Dialog */
.dialog-overlay {
  position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,.7);
  backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 1.5rem;
}
.dialog {
  width: 100%; max-width: 360px; background: #1e293b;
  border: 1px solid rgba(255,255,255,.08); border-radius: 1.25rem; padding: 1.5rem;
  display: flex; flex-direction: column; gap: .875rem;
}
.dialog-title { margin: 0; font-size: 1rem; font-weight: 600; }
.dialog-sub { margin: 0; font-size: .875rem; color: #64748b; }
.dialog-actions { display: flex; gap: .625rem; }
.btn-danger {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: .375rem;
  padding: .75rem; background: #dc2626; border: none; border-radius: .75rem;
  color: #fff; font-size: .9375rem; font-weight: 600; font-family: inherit; cursor: pointer;
}
.btn-danger:disabled { opacity: .6; cursor: not-allowed; }
.rename-input {
  padding: .8125rem 1rem; background: #0f172a; border: 1.5px solid rgba(255,255,255,.08);
  border-radius: .75rem; color: #f8fafc; font-size: 1rem; font-family: inherit; outline: none;
}
.rename-input:focus { border-color: #6366f1; }
.rename-input:disabled { opacity: .5; }
.btn-save {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: .375rem;
  padding: .75rem; background: #6366f1; border: none; border-radius: .75rem;
  color: #fff; font-size: .9375rem; font-weight: 600; font-family: inherit; cursor: pointer;
}
.btn-save:disabled { opacity: .6; cursor: not-allowed; }
.btn-ghost {
  flex: 1; padding: .75rem; background: transparent; border: 1px solid rgba(255,255,255,.1);
  border-radius: .75rem; color: #64748b; font-size: .9375rem; font-family: inherit; cursor: pointer;
}
</style>
