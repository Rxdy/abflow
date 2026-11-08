import { ensureFreshToken } from '../composables/useAuth'
import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import TimelineView from '../views/TimelineView.vue'
import UploadView from '../views/UploadView.vue'
import SettingsView from '../views/SettingsView.vue'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    requiresGuest?: boolean
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'login',
      component: LoginView,
      meta: { requiresGuest: true },
    },
    {
      path: '/files',
      name: 'files',
      component: TimelineView,
      meta: { requiresAuth: true },
    },
    {
      path: '/upload',
      name: 'upload',
      component: UploadView,
      meta: { requiresAuth: true },
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsView,
      meta: { requiresAuth: true },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

router.beforeEach(async (to) => {
  // Jeton absent ou presque expiré : le cookie de session (un an, prolongé à chaque usage) en redonne un.
  const connecte = await ensureFreshToken()
  if (!connecte) localStorage.removeItem('auth_token')
  if (to.meta.requiresAuth && !connecte) return { name: 'login' }
  if (to.meta.requiresGuest && connecte) return { name: 'upload' }
  return true
})

export default router
