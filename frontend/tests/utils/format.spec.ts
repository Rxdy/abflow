import { describe, it, expect } from 'vitest'
import { formatSize, formatSizeExact } from '../../src/utils/format'

describe('formatSize', () => {
  it('formats bytes', () => {
    expect(formatSize(500)).toBe('500 o')
  })

  it('formats kilobytes', () => {
    expect(formatSize(2048)).toBe('2.0 Ko')
  })

  it('formats megabytes', () => {
    expect(formatSize(5 * 1024 ** 2)).toBe('5.0 Mo')
  })

  it('formats gigabytes', () => {
    expect(formatSize(2 * 1024 ** 3)).toBe('2.00 Go')
  })

  it('formats zero bytes', () => {
    expect(formatSize(0)).toBe('0 o')
  })
})

describe('formatSizeExact', () => {
  it('never rounds, unlike formatSize', () => {
    // 2000 Mio et 1953 Mio arrondissent tous les deux à "1.95 Go" avec
    // formatSize() — formatSizeExact() doit rester distinguable.
    expect(formatSizeExact(2000 * 1024 * 1024)).not.toBe(formatSizeExact(1953 * 1024 * 1024))
  })

  it('formats with French thousands separators', () => {
    expect(formatSizeExact(4_161_489)).toBe(`${(4_161_489).toLocaleString('fr-FR')} o`)
  })
})
