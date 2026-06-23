<template>
  <footer class="app-footer">
    <span class="footer-app">{{ appName }}</span>
    <span class="footer-sep" aria-hidden="true">·</span>
    <span class="footer-copy">© {{ year }} <strong>Abnd</strong></span>
  </footer>
</template>

<script setup lang="ts">
const appName = import.meta.env.VITE_APP_NAME || 'AbFlow'
const year = new Date().getFullYear()
</script>

<style scoped>
.app-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.875rem 1.25rem;
  font-size: 0.75rem;
  color: #334155;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  flex-shrink: 0;
}

.footer-app {
  font-weight: 600;
  color: #475569;
}

.footer-copy strong {
  font-weight: 600;
  color: #475569;
}
</style>
