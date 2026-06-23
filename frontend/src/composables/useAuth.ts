import { ref } from 'vue'
import { useRouter } from 'vue-router'

const token = ref<string | null>(localStorage.getItem('auth_token'))

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
    router.push({ name: 'login', query: expired ? { expired: '1' } : {} })
  }

  function authHeaders(): Record<string, string> {
    return token.value ? { Authorization: `Bearer ${token.value}` } : {}
  }

  return { token, login, logout, authHeaders }
}
