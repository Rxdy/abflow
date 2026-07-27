<template>
  <div class="settings-page">
    <header class="page-header">
      <div class="page-header-row">
        <RouterLink to="/files" class="btn-back" title="Retour">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </RouterLink>
        <h1 class="page-title">Clés API</h1>
      </div>
      <p class="page-sub">
        Pour connecter une autre application (comme AbView) en lecture seule — elle ne
        pourra récupérer que les images, rien d'autre.
      </p>
    </header>

    <div class="settings-content">
      <form class="new-key-form" @submit.prevent="doCreate">
        <input
          v-model="newKeyName"
          class="name-input"
          type="text"
          maxlength="100"
          placeholder="Nom de la clé (ex: AbView)"
          :disabled="creating"
        />
        <button class="btn-primary" type="submit" :disabled="creating || !newKeyName.trim()">
          <span v-if="creating" class="spinner-sm"></span>
          {{ creating ? 'Génération…' : 'Générer une clé' }}
        </button>
      </form>

      <p v-if="errorMsg" class="error-msg" role="alert">{{ errorMsg }}</p>

      <p v-if="!loading && keys.length === 0" class="empty-hint">Aucune clé pour l'instant.</p>

      <div v-if="keys.length > 0" class="key-list">
        <div v-for="k in keys" :key="k.id" class="key-item">
          <div class="key-body">
            <div class="key-name">{{ k.name }}</div>
            <div class="key-meta">créée le {{ formatDate(k.createdAt) }}</div>
          </div>
          <button class="key-remove" title="Révoquer" @click="revokeTarget = k">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Reveal the plaintext key once, right after creation -->
    <Teleport to="body">
      <div v-if="revealedKey" class="dialog-overlay">
        <div class="dialog">
          <h3 class="dialog-title">Clé "{{ revealedKey.name }}" créée</h3>
          <p class="dialog-sub">
            Copie-la maintenant — elle ne sera plus jamais affichée.
          </p>
          <div class="key-reveal">
            <code class="key-reveal-value">{{ revealedKey.key }}</code>
          </div>
          <div class="dialog-actions">
            <button class="btn-save" @click="copyRevealedKey">
              {{ copied ? 'Copié !' : 'Copier' }}
            </button>
            <button class="btn-ghost" @click="revealedKey = null">Fermer</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Revoke confirm -->
    <Teleport to="body">
      <div v-if="revokeTarget" class="dialog-overlay" @click.self="revokeTarget = null">
        <div class="dialog">
          <h3 class="dialog-title">Révoquer "{{ revokeTarget.name }}" ?</h3>
          <p class="dialog-sub">
            Toute application utilisant cette clé perdra immédiatement l'accès. Irréversible.
          </p>
          <div class="dialog-actions">
            <button class="btn-danger" :disabled="revoking" @click="doRevoke">
              <span v-if="revoking" class="spinner-sm"></span>
              {{ revoking ? 'Révocation…' : 'Révoquer' }}
            </button>
            <button class="btn-ghost" @click="revokeTarget = null">Annuler</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useApi } from '../composables/useApi'
import type { ApiKey, ApiKeyCreated } from '../types'

const { getApiKeys, createApiKey, deleteApiKey } = useApi()

const keys         = ref<ApiKey[]>([])
const loading      = ref(true)
const creating     = ref(false)
const revoking     = ref(false)
const newKeyName   = ref('')
const errorMsg     = ref('')
const revealedKey  = ref<ApiKeyCreated | null>(null)
const revokeTarget = ref<ApiKey | null>(null)
const copied       = ref(false)

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

async function loadKeys(): Promise<void> {
  loading.value = true
  try { keys.value = await getApiKeys() }
  catch (e) { errorMsg.value = (e as Error).message }
  finally { loading.value = false }
}

async function doCreate(): Promise<void> {
  const name = newKeyName.value.trim()
  if (!name) return
  creating.value = true
  errorMsg.value = ''
  try {
    const created = await createApiKey(name)
    newKeyName.value = ''
    revealedKey.value = created
    copied.value = false
    await loadKeys()
  } catch (e) {
    errorMsg.value = (e as Error).message
  } finally {
    creating.value = false
  }
}

async function copyRevealedKey(): Promise<void> {
  if (!revealedKey.value) return
  await navigator.clipboard.writeText(revealedKey.value.key)
  copied.value = true
}

async function doRevoke(): Promise<void> {
  if (!revokeTarget.value) return
  revoking.value = true
  try {
    await deleteApiKey(revokeTarget.value.id)
    revokeTarget.value = null
    await loadKeys()
  } catch (e) {
    errorMsg.value = (e as Error).message
  } finally {
    revoking.value = false
  }
}

onMounted(loadKeys)
</script>

<style scoped>
.settings-page {
  min-height: 100dvh;
  background: #0f172a;
  color: #f8fafc;
  padding-bottom: 5rem;
}

.page-header { padding: 1.25rem 1.25rem 0; }
.page-header-row { display: flex; align-items: center; gap: .625rem; margin-bottom: .375rem; }
.page-title { margin: 0; font-size: 1.25rem; font-weight: 700; letter-spacing: -0.02em; }
.page-sub { margin: 0 0 1.25rem; font-size: .8125rem; color: #64748b; line-height: 1.4; }

.btn-back {
  display: flex; align-items: center; justify-content: center;
  width: 2rem; height: 2rem; flex-shrink: 0;
  background: transparent; border: 1px solid rgba(255,255,255,.1);
  border-radius: .5rem; color: #94a3b8; text-decoration: none;
  transition: color .2s, border-color .2s;
  -webkit-tap-highlight-color: transparent;
}
.btn-back:hover { color: #e2e8f0; border-color: rgba(255,255,255,.2); }

.settings-content {
  padding: 0 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.new-key-form { display: flex; flex-direction: column; gap: .625rem; }

.name-input {
  padding: .8125rem 1rem; background: #1e293b; border: 1.5px solid rgba(255,255,255,.08);
  border-radius: .75rem; color: #f8fafc; font-size: 1rem; font-family: inherit; outline: none;
}
.name-input:focus { border-color: #6366f1; }
.name-input:disabled { opacity: .5; }

.btn-primary {
  display: flex; align-items: center; justify-content: center; gap: .375rem;
  padding: .875rem; background: #6366f1; border: none;
  border-radius: .875rem; color: #fff; font-size: 1rem; font-weight: 600;
  font-family: inherit; cursor: pointer; transition: background .2s, transform .1s;
  -webkit-tap-highlight-color: transparent;
}
.btn-primary:hover { background: #4f46e5; }
.btn-primary:active { transform: scale(.98); }
.btn-primary:disabled { opacity: .6; cursor: not-allowed; }

.empty-hint { margin: 0; font-size: .875rem; color: #475569; text-align: center; padding: 1rem 0; }

.key-list { display: flex; flex-direction: column; gap: .5rem; }

.key-item {
  display: flex; align-items: center; gap: .75rem;
  padding: .875rem; background: #1e293b; border-radius: .75rem;
  border: 1px solid rgba(255,255,255,.06);
}
.key-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .2rem; }
.key-name {
  font-size: .875rem; font-weight: 500; color: #e2e8f0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.key-meta { font-size: .6875rem; color: #475569; }

.key-remove {
  flex-shrink: 0; background: none; border: none; color: #475569; cursor: pointer;
  padding: .375rem; border-radius: .375rem; line-height: 1; transition: color .15s;
}
.key-remove:hover { color: #f87171; }

.spinner-sm {
  display: inline-block; width: 1rem; height: 1rem;
  border: 2px solid rgba(255,255,255,.3); border-top-color: #fff;
  border-radius: 50%; animation: spin .7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.error-msg {
  margin: 0; padding: .625rem .875rem;
  background: rgba(239,68,68,.1); border: 1px solid rgba(239,68,68,.25);
  border-radius: .625rem; color: #f87171; font-size: .875rem;
}

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
.dialog-title { margin: 0; font-size: 1rem; font-weight: 600; color: #f8fafc; }
.dialog-sub { margin: 0; font-size: .875rem; color: #64748b; line-height: 1.4; }
.dialog-actions { display: flex; gap: .625rem; }

.key-reveal {
  padding: .75rem .875rem; background: #0f172a; border: 1px solid rgba(99,102,241,.3);
  border-radius: .625rem; overflow-x: auto;
}
.key-reveal-value {
  font-family: ui-monospace, monospace; font-size: .8125rem; color: #a5b4fc;
  white-space: nowrap;
}

.btn-danger {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: .375rem;
  padding: .75rem; background: #dc2626; border: none; border-radius: .75rem;
  color: #fff; font-size: .9375rem; font-weight: 600; font-family: inherit; cursor: pointer;
}
.btn-danger:disabled { opacity: .6; cursor: not-allowed; }
.btn-save {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: .375rem;
  padding: .75rem; background: #6366f1; border: none; border-radius: .75rem;
  color: #fff; font-size: .9375rem; font-weight: 600; font-family: inherit; cursor: pointer;
}
.btn-ghost {
  flex: 1; padding: .75rem; background: transparent; border: 1px solid rgba(255,255,255,.1);
  border-radius: .75rem; color: #64748b; font-size: .9375rem; font-family: inherit; cursor: pointer;
}
</style>
