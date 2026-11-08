import { ref } from 'vue'
import { useRouter } from 'vue-router'

const token = ref<string | null>(localStorage.getItem('auth_token'))

// Date d'expiration (secondes) lue dans le jeton, sans le vérifier : le serveur reste juge.
function expiration(jeton: string | null): number {
  if (!jeton) return 0
  try {
    const charge = JSON.parse(atob(jeton.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number }
    return charge.exp ?? 0
  } catch { return 0 }
}

let renouvellement: Promise<boolean> | null = null

/**
 * Renouvelle le jeton d'accès (24 h) grâce au cookie de session du navigateur, valable un an et prolongé à
 * chaque usage : on n'a pas à retaper le mot de passe. Faux s'il n'y a pas de session valide.
 */
export function refreshSession(): Promise<boolean> {
  renouvellement ??= (async () => {
    try {
      const res = await fetch('/api/auth/refresh', { method: 'POST' })
      if (!res.ok) return false
      const data = (await res.json()) as { token?: string }
      if (!data.token) return false
      token.value = data.token
      localStorage.setItem('auth_token', data.token)
      return true
    } catch { return false }
    finally { renouvellement = null }
  })()
  return renouvellement
}

/** Garantit un jeton valable : le renouvelle s'il expire dans moins de 5 minutes. Faux si on est déconnecté. */
export async function ensureFreshToken(): Promise<boolean> {
  token.value = localStorage.getItem('auth_token') // un autre onglet a pu le renouveler ou se déconnecter
  const restant = expiration(token.value) - Date.now() / 1000
  if (restant > 300) return true
  const ok = await refreshSession()
  return ok || restant > 0 // hors ligne : on garde le jeton encore valable
}

export function useAuth() {
  const router = useRouter()

  async function login(username: string, password: string): Promise<void> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = (await res.json()) as { token?: string; error?: string }
    if (!res.ok) throw new Error(data.error ?? 'Login failed')
    token.value = data.token!
    localStorage.setItem('auth_token', data.token!)
    await router.push({ name: 'files' })
  }

  function logout(expired = false): void {
    token.value = null
    localStorage.removeItem('auth_token')
    // Efface aussi le cookie de session, sinon la connexion se rouvrirait toute seule.
    try { void Promise.resolve(fetch('/api/auth/logout', { method: 'POST' })).catch(() => {}) } catch { /* hors ligne */ }
    router.push({ name: 'login', query: expired ? { expired: '1' } : {} })
  }

  function authHeaders(): Record<string, string> {
    return token.value ? { Authorization: `Bearer ${token.value}` } : {}
  }

  return { token, login, logout, authHeaders }
}
