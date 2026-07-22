<template>
  <div class="upload-page">
    <header class="page-header">
      <h1 class="page-title">Ajouter des fichiers</h1>
    </header>

    <div class="upload-content">
      <!-- Drop zone -->
      <div
        class="drop-zone"
        :class="{ 'drop-zone--active': isDragging }"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="onDrop"
        @click="openFilePicker()"
      >
        <div class="drop-icon-wrap">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="16 16 12 12 8 16"/>
            <line x1="12" y1="12" x2="12" y2="21"/>
            <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
          </svg>
        </div>
        <p class="drop-text">
          {{ queue.length > 0 ? 'Ajouter d\'autres fichiers' : 'Appuyez pour choisir des fichiers' }}
        </p>
        <p class="drop-hint">ou glissez-déposez ici · images, vidéos, audio, documents… · max 200 Mo</p>
      </div>

      <input ref="fileInput" type="file" accept="*/*" multiple
        style="display:none" @change="onFileChange" />

      <!-- File queue -->
      <div v-if="queue.length > 0" class="queue">
        <div v-for="item in queue" :key="item.id" class="queue-item">
          <!-- Preview / icon -->
          <div class="qi-thumb">
            <img v-if="item.preview" :src="item.preview" alt="" class="qi-img" />
            <span v-else class="qi-emoji">{{ typeEmoji(fileTypeOf(item.file)) }}</span>
          </div>

          <!-- Info + progress -->
          <div class="qi-body">
            <div class="qi-name">{{ item.file.name }}</div>
            <div class="qi-meta">{{ formatSize(item.file.size) }}</div>
            <div v-if="item.status === 'uploading'" class="qi-progress">
              <div class="qi-bar">
                <div class="qi-fill" :style="{ width: item.progress + '%' }"></div>
              </div>
              <span class="qi-pct">{{ item.progress }}%</span>
            </div>
          </div>

          <!-- Status icon -->
          <div class="qi-status">
            <span v-if="item.status === 'pending'" class="qi-badge qi-badge--pending">En attente</span>
            <span v-else-if="item.status === 'uploading'" class="spinner-sm"></span>
            <svg v-else-if="item.status === 'done'" class="qi-icon-ok" xmlns="http://www.w3.org/2000/svg"
              width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span v-else-if="item.status === 'error'" class="qi-badge qi-badge--error" :title="item.errorMsg">✕</span>
          </div>

          <!-- Remove (only when pending) -->
          <button v-if="item.status === 'pending' && !uploading" class="qi-remove"
            @click.stop="removeFromQueue(item.id)">✕</button>
        </div>
      </div>

      <!-- Error summary -->
      <p v-if="errorMsg" class="error-msg" role="alert">{{ errorMsg }}</p>

      <!-- Upload button -->
      <button
        v-if="pendingCount > 0 && !uploading"
        class="btn-primary"
        @click="doUpload"
      >
        Publier {{ pendingCount }} fichier{{ pendingCount > 1 ? 's' : '' }}
      </button>

      <!-- Success toast -->
      <div v-if="successMsg" class="success-toast" role="status">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        {{ successMsg }}
      </div>

      <!-- Stats -->
      <div v-if="stats" class="stats-card">
        <div class="stat">
          <span class="stat-value">{{ stats.count }}</span>
          <span class="stat-label">fichiers</span>
        </div>
        <div class="stat-sep"></div>
        <div class="stat">
          <span class="stat-value">{{ formatSize(stats.totalSize) }}</span>
          <span class="stat-label">stockés</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useApi } from '../composables/useApi'
import { useStats } from '../composables/useStats'
import { formatSize } from '../utils/format'
import type { FileType } from '../types'

const { uploadImageWithProgress } = useApi()
const { stats, refreshStats } = useStats()

const FILE_TYPES: Record<FileType, RegExp> = {
  image:    /\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff|avif|heic|heif)$/i,
  video:    /\.(mp4|mov|avi|mkv|webm|m4v|wmv|flv|ogv)$/i,
  audio:    /\.(mp3|wav|ogg|flac|aac|m4a|wma|opus)$/i,
  document: /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|md|csv|odt|ods|odp|rtf)$/i,
  archive:  /\.(zip|tar|gz|rar|7z|bz2|xz)$/i,
  other:    /^$/,
}
const TYPE_EMOJIS: Record<FileType, string> = {
  image: '🖼️', video: '🎬', audio: '🎵', document: '📄', archive: '📦', other: '📎',
}

function fileTypeOf(file: File): FileType {
  for (const [type, re] of Object.entries(FILE_TYPES) as [FileType, RegExp][]) {
    if (re.test(file.name)) return type
  }
  return 'other'
}
function typeEmoji(t: FileType): string { return TYPE_EMOJIS[t] ?? '📎' }

interface QueueItem {
  id: string
  file: File
  status: 'pending' | 'uploading' | 'done' | 'error'
  progress: number
  errorMsg: string
  preview: string | null
}

let nextId = 0

const fileInput  = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)
const uploading  = ref(false)
const errorMsg   = ref('')
const successMsg = ref('')
const queue      = ref<QueueItem[]>([])

const pendingCount = computed(() => queue.value.filter(i => i.status === 'pending').length)

function openFilePicker(): void { fileInput.value?.click() }

function onFileChange(e: Event): void {
  const input = e.target as HTMLInputElement
  addFiles(input.files)
  input.value = ''
}
function onDrop(e: DragEvent): void {
  isDragging.value = false
  addFiles(e.dataTransfer?.files ?? null)
}

function addFiles(files: FileList | null | undefined): void {
  if (!files) return
  errorMsg.value = ''
  for (const file of Array.from(files)) {
    if (file.size > 200 * 1024 * 1024) {
      errorMsg.value = `"${file.name}" dépasse 200 Mo — ignoré`
      continue
    }
    const item: QueueItem = {
      id: String(nextId++),
      file,
      status: 'pending',
      progress: 0,
      errorMsg: '',
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
    }
    queue.value.push(item)
  }
}

function removeFromQueue(id: string): void {
  const idx = queue.value.findIndex(i => i.id === id)
  if (idx === -1) return
  const item = queue.value[idx]
  if (item.preview) URL.revokeObjectURL(item.preview)
  queue.value.splice(idx, 1)
}

async function doUpload(): Promise<void> {
  const pending = queue.value.filter(i => i.status === 'pending')
  if (pending.length === 0) return
  uploading.value = true
  errorMsg.value = ''
  let doneCount = 0

  for (const item of pending) {
    item.status = 'uploading'
    item.progress = 0
    try {
      await uploadImageWithProgress(item.file, (pct) => { item.progress = pct })
      item.status = 'done'
      item.progress = 100
      doneCount++
    } catch (e) {
      item.status = 'error'
      item.errorMsg = (e as Error).message
    }
  }

  uploading.value = false
  successMsg.value = doneCount === 1
    ? '1 fichier publié !'
    : `${doneCount} fichiers publiés !`
  setTimeout(() => { successMsg.value = '' }, 3000)
  await refreshStats()
}

// Avertir si on quitte la page pendant un upload en cours
function onBeforeUnload(e: BeforeUnloadEvent): void {
  if (uploading.value) { e.preventDefault(); e.returnValue = '' }
}

onMounted(async () => {
  await refreshStats()
  window.addEventListener('beforeunload', onBeforeUnload)
})
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
  queue.value.forEach(i => { if (i.preview) URL.revokeObjectURL(i.preview) })
})
</script>

<style scoped>
.upload-page {
  min-height: 100dvh;
  background: #0f172a;
  color: #f8fafc;
  padding-bottom: 5rem;
}

.page-header { padding: 1.25rem 1.25rem 0; }
.page-title { margin: 0 0 1.25rem; font-size: 1.25rem; font-weight: 700; letter-spacing: -0.02em; }

.upload-content {
  padding: 0 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Drop zone */
.drop-zone {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 0.5rem; padding: 1.75rem 1.5rem;
  background: #1e293b; border: 2px dashed rgba(99,102,241,.4);
  border-radius: 1rem; cursor: pointer; transition: border-color .2s, background .2s;
  -webkit-tap-highlight-color: transparent;
}
.drop-zone:hover, .drop-zone--active { border-color: #6366f1; background: rgba(99,102,241,.06); }
.drop-icon-wrap {
  width: 3rem; height: 3rem; background: rgba(99,102,241,.12); border-radius: 50%;
  display: flex; align-items: center; justify-content: center; color: #6366f1;
}
.drop-text { margin: 0; font-size: .9375rem; font-weight: 500; color: #e2e8f0; }
.drop-hint { margin: 0; font-size: .75rem; color: #475569; text-align: center; }

/* Queue */
.queue { display: flex; flex-direction: column; gap: .5rem; }

.queue-item {
  display: flex; align-items: center; gap: .75rem;
  padding: .75rem; background: #1e293b; border-radius: .75rem;
  border: 1px solid rgba(255,255,255,.06);
}

.qi-thumb {
  width: 2.75rem; height: 2.75rem; border-radius: .5rem; flex-shrink: 0;
  background: #0f172a; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
}
.qi-img { width: 100%; height: 100%; object-fit: cover; }
.qi-emoji { font-size: 1.25rem; }

.qi-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .2rem; }
.qi-name {
  font-size: .8125rem; font-weight: 500; color: #e2e8f0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.qi-meta { font-size: .6875rem; color: #475569; }

.qi-progress { display: flex; align-items: center; gap: .5rem; margin-top: .25rem; }
.qi-bar { flex: 1; height: .25rem; background: rgba(99,102,241,.15); border-radius: 9999px; overflow: hidden; }
.qi-fill { height: 100%; background: #6366f1; border-radius: 9999px; transition: width .1s linear; }
.qi-pct { font-size: .6875rem; color: #6366f1; font-weight: 600; flex-shrink: 0; min-width: 2rem; }

.qi-status { flex-shrink: 0; display: flex; align-items: center; }
.qi-badge {
  font-size: .6875rem; padding: .2rem .5rem; border-radius: 9999px; font-weight: 500;
}
.qi-badge--pending { background: rgba(255,255,255,.06); color: #64748b; }
.qi-badge--error { background: rgba(239,68,68,.15); color: #f87171; cursor: help; }
.qi-icon-ok { color: #4ade80; }

.qi-remove {
  flex-shrink: 0; background: none; border: none; color: #475569; cursor: pointer;
  font-size: .875rem; padding: .25rem; border-radius: .25rem; line-height: 1;
  transition: color .15s;
}
.qi-remove:hover { color: #94a3b8; }

.spinner-sm {
  display: inline-block; width: 1rem; height: 1rem;
  border: 2px solid rgba(99,102,241,.2); border-top-color: #6366f1;
  border-radius: 50%; animation: spin .7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Buttons */
.btn-primary {
  display: flex; align-items: center; justify-content: center;
  padding: .875rem; background: #6366f1; border: none;
  border-radius: .875rem; color: #fff; font-size: 1rem; font-weight: 600;
  font-family: inherit; cursor: pointer; transition: background .2s, transform .1s;
  -webkit-tap-highlight-color: transparent;
}
.btn-primary:hover { background: #4f46e5; }
.btn-primary:active { transform: scale(.98); }

/* Messages */
.error-msg {
  margin: 0; padding: .625rem .875rem;
  background: rgba(239,68,68,.1); border: 1px solid rgba(239,68,68,.25);
  border-radius: .625rem; color: #f87171; font-size: .875rem;
}
.success-toast {
  display: flex; align-items: center; gap: .5rem; padding: .75rem 1rem;
  background: rgba(74,222,128,.1); border: 1px solid rgba(74,222,128,.25);
  border-radius: .75rem; color: #4ade80; font-size: .875rem; font-weight: 500;
}

/* Stats */
.stats-card {
  display: flex; align-items: center; justify-content: center; gap: 1.5rem;
  padding: 1rem; background: #1e293b; border-radius: .875rem;
}
.stat { display: flex; flex-direction: column; align-items: center; gap: .125rem; }
.stat-value { font-size: 1.25rem; font-weight: 700; color: #f8fafc; }
.stat-label { font-size: .75rem; color: #64748b; }
.stat-sep { width: 1px; height: 2rem; background: rgba(255,255,255,.08); }
</style>
