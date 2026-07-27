<template>
  <header class="app-header">
    <div class="app-header-row">
      <span class="app-header-name">{{ appName }}</span>
      <div v-if="isAuth" class="app-header-actions">
        <RouterLink to="/settings" class="app-header-btn app-header-btn--settings" title="Clés API">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l1.8-1.8a1 1 0 0 0 0-1.4L18.6 4.3a1 1 0 0 0-1.4 0l-1.8 1.8a1 1 0 0 0 0 1.4Z"/>
            <path d="m8.5 14.5-4.9 4.9a2 2 0 1 0 2.8 2.8l4.9-4.9"/>
            <path d="m14 9-4.5 4.5"/>
          </svg>
        </RouterLink>
        <button class="app-header-btn" @click="() => logout()" title="Déconnexion">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </div>
    <div v-if="storagePct !== null" class="storage-bar" :title="storageTitle">
      <div class="storage-bar-track">
        <div class="storage-bar-fill" :class="storageLevelClass" :style="{ width: storagePct + '%' }"></div>
      </div>
      <span class="storage-bar-label">{{ storageLabel }}</span>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { useStats } from '../composables/useStats'
import { formatSize } from '../utils/format'

const appName = import.meta.env.VITE_APP_NAME || 'AbFlow'
const { token, logout } = useAuth()
const isAuth = computed(() => Boolean(token.value))

const { stats, refreshStats } = useStats()
onMounted(refreshStats)

const storagePct = computed(() => {
  const quota = stats.value?.quotaBytes
  if (!quota) return null
  return Math.min(100, Math.round((stats.value!.totalSize / quota) * 1000) / 10)
})

const storageLevelClass = computed(() => {
  const pct = storagePct.value ?? 0
  if (pct >= 90) return 'storage-bar-fill--danger'
  if (pct >= 70) return 'storage-bar-fill--warn'
  return ''
})

const storageLabel = computed(() => {
  if (!stats.value?.quotaBytes) return ''
  const remaining = stats.value.quotaBytes - stats.value.totalSize
  return `${formatSize(Math.max(0, remaining))} restants sur ${formatSize(stats.value.quotaBytes)}`
})

// Tooltip natif (hover) — le pourcentage exact, plus lisible que les octets bruts.
const storageTitle = computed(() => {
  if (!stats.value?.quotaBytes) return ''
  const { totalSize, quotaBytes } = stats.value
  const pct = ((totalSize / quotaBytes) * 100).toFixed(2)
  return `${pct} % utilisés`
})
</script>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  background: rgba(15, 23, 42, 0.96);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
  /* En PWA sur iPhone (status bar "black-translucent"), le contenu passe SOUS
     l'encoche/Dynamic Island et la barre système — sans ce padding, le nom de
     l'app et les boutons clé API/déconnexion sont invisibles ou cliqués à
     travers l'heure/le réseau/la batterie. */
  padding-top: env(safe-area-inset-top);
}

.app-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.25rem;
  height: 3rem;
}

.storage-bar {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0 1.25rem 0.5rem;
}

.storage-bar-track {
  flex: 1;
  height: 0.3rem;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 9999px;
  overflow: hidden;
}

.storage-bar-fill {
  height: 100%;
  background: #6366f1;
  border-radius: 9999px;
  transition: width 0.3s ease;
}

.storage-bar-fill--warn { background: #f59e0b; }
.storage-bar-fill--danger { background: #f87171; }

.storage-bar-label {
  font-size: 0.6875rem;
  color: #64748b;
  white-space: nowrap;
  flex-shrink: 0;
}

.app-header-name {
  font-size: 1rem;
  font-weight: 700;
  color: #f8fafc;
  letter-spacing: -0.02em;
}

.app-header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.app-header-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.5rem;
  color: #64748b;
  text-decoration: none;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s;
  -webkit-tap-highlight-color: transparent;
}

.app-header-btn:hover {
  color: #f87171;
  border-color: rgba(248, 113, 113, 0.3);
}

.app-header-btn--settings:hover {
  color: #818cf8;
  border-color: rgba(99, 102, 241, 0.3);
}
</style>
