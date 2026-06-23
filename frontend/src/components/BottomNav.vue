<template>
  <nav class="bottom-nav">
    <RouterLink to="/files" class="nav-item" active-class="nav-item--active">
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
      <span>Fichiers</span>
    </RouterLink>
    <RouterLink to="/upload" class="nav-item" active-class="nav-item--active">
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="16"/>
        <line x1="8" y1="12" x2="16" y2="12"/>
      </svg>
      <span>Ajouter</span>
    </RouterLink>
  </nav>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<style scoped>
.bottom-nav {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  z-index: 50;
  display: flex;
  background: rgba(15, 23, 42, 0.96);
  backdrop-filter: blur(16px);
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  padding-bottom: env(safe-area-inset-bottom);
}

.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: .25rem;
  padding: .625rem .5rem;
  background: none;
  border: none;
  color: #475569;
  font-size: .6875rem;
  font-family: inherit;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  transition: color .2s;
  -webkit-tap-highlight-color: transparent;
}

.nav-item:hover { color: #94a3b8; }

.nav-item--active { color: #818cf8; }

</style>
