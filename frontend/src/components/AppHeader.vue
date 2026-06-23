<template>
  <header class="app-header">
    <span class="app-header-name">{{ appName }}</span>
    <button v-if="isAuth" class="app-header-logout" @click="logout" title="Déconnexion">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
        <polyline points="16 17 21 12 16 7"/>
        <line x1="21" y1="12" x2="9" y2="12"/>
      </svg>
      <span class="app-header-logout-label">Déconnexion</span>
    </button>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAuth } from '../composables/useAuth'

const appName = import.meta.env.VITE_APP_NAME || 'AbFlow'
const { token, logout } = useAuth()
const isAuth = computed(() => Boolean(token.value))
</script>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.25rem;
  height: 3rem;
  background: rgba(15, 23, 42, 0.96);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.app-header-name {
  font-size: 1rem;
  font-weight: 700;
  color: #f8fafc;
  letter-spacing: -0.02em;
}

.app-header-logout {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.4375rem 0.75rem;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.5rem;
  color: #64748b;
  font-size: 0.8125rem;
  font-family: inherit;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s;
  -webkit-tap-highlight-color: transparent;
}

.app-header-logout:hover {
  color: #f87171;
  border-color: rgba(248, 113, 113, 0.3);
}

@media (max-width: 360px) {
  .app-header-logout-label { display: none; }
}
</style>
