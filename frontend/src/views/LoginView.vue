<template>
  <div class="login-page">
    <div class="login-card">
      <div class="brand">
        <h1 class="brand-name">{{ appName }}</h1>
        <p class="brand-sub">Accès privé</p>
      </div>

      <form class="login-form" @submit.prevent="handleSubmit" novalidate>
        <div class="field">
          <label for="username">Identifiant</label>
          <input
            id="username"
            v-model="username"
            type="text"
            autocomplete="username"
            autocapitalize="none"
            spellcheck="false"
            placeholder="Votre identifiant"
            :disabled="loading"
            required
          />
        </div>

        <div class="field">
          <label for="password">Mot de passe</label>
          <input
            id="password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            placeholder="Votre mot de passe"
            :disabled="loading"
            required
          />
        </div>

        <p v-if="sessionExpired" class="info-msg" role="status">Session expirée, veuillez vous reconnecter.</p>
        <p v-if="errorMsg" class="error-msg" role="alert">{{ errorMsg }}</p>

        <button type="submit" class="btn-login" :disabled="loading">
          <span v-if="loading" class="spinner" aria-hidden="true"></span>
          <span>{{ loading ? 'Connexion…' : 'Se connecter' }}</span>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '../composables/useAuth'

const appName = import.meta.env.VITE_APP_NAME || 'AbFlow'

const { login } = useAuth()
const route = useRoute()
const sessionExpired = route.query.expired === '1'

const username = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')

async function handleSubmit(): Promise<void> {
  if (!username.value || !password.value) {
    errorMsg.value = 'Veuillez remplir tous les champs.'
    return
  }
  errorMsg.value = ''
  loading.value = true
  try {
    await login(username.value, password.value)
  } catch (err) {
    errorMsg.value = (err as Error).message === 'Invalid credentials'
      ? 'Identifiant ou mot de passe incorrect.'
      : 'Erreur de connexion. Réessayez.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem 1.25rem;
  background: linear-gradient(160deg, #1e293b 0%, #0f172a 100%);
}

.login-card {
  width: 100%;
  max-width: 400px;
  background: #1e293b;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 1.5rem;
  padding: 2.5rem 2rem;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.5);
}

.brand {
  text-align: center;
  margin-bottom: 2rem;
}

.brand-icon {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
}

.brand-name {
  margin: 0 0 0.25rem;
  font-size: 1.75rem;
  font-weight: 700;
  color: #f8fafc;
  letter-spacing: -0.03em;
}

.brand-sub {
  margin: 0;
  font-size: 0.875rem;
  color: #64748b;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.field label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #94a3b8;
  letter-spacing: 0.02em;
}

.field input {
  padding: 0.8125rem 1rem;
  background: #0f172a;
  border: 1.5px solid rgba(255, 255, 255, 0.08);
  border-radius: 0.75rem;
  color: #f8fafc;
  font-size: 1rem;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s;
  -webkit-appearance: none;
}

.field input:focus {
  border-color: #6366f1;
}

.field input::placeholder {
  color: #334155;
}

.field input:disabled {
  opacity: 0.5;
}

.info-msg {
  margin: 0;
  padding: 0.625rem 0.875rem;
  background: rgba(99, 102, 241, 0.12);
  border: 1px solid rgba(99, 102, 241, 0.25);
  border-radius: 0.625rem;
  color: #a5b4fc;
  font-size: 0.875rem;
}

.error-msg {
  margin: 0;
  padding: 0.625rem 0.875rem;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: 0.625rem;
  color: #f87171;
  font-size: 0.875rem;
}

.btn-login {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
  padding: 0.875rem 1rem;
  background: #6366f1;
  border: none;
  border-radius: 0.875rem;
  color: #fff;
  font-size: 1rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.2s, transform 0.1s;
  -webkit-tap-highlight-color: transparent;
}

.btn-login:hover:not(:disabled) {
  background: #4f46e5;
}

.btn-login:active:not(:disabled) {
  transform: scale(0.98);
}

.btn-login:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

</style>
