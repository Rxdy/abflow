import { ref } from 'vue'
import { useApi } from './useApi'
import type { Stats } from '../types'

const stats = ref<Stats | null>(null)

export function useStats() {
  const { getStats } = useApi()

  async function refreshStats(): Promise<void> {
    stats.value = await getStats()
  }

  return { stats, refreshStats }
}
