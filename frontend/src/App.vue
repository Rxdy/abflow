<template>
  <div class="app-shell">
    <AppHeader v-if="isAuthenticated" />
    <main class="app-main">
      <RouterView />
    </main>
    <AppFooter v-if="!isAuthenticated" />
    <BottomNav v-if="isAuthenticated" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppHeader from './components/AppHeader.vue'
import AppFooter from './components/AppFooter.vue'
import BottomNav from './components/BottomNav.vue'

const route = useRoute()
const isAuthenticated = computed(() => Boolean(route.meta.requiresAuth))
</script>

<style>
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  -webkit-font-smoothing: antialiased;
  background: #0f172a;
}

.app-shell {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
}
</style>
