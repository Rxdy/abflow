import { describe, it, expect } from 'vitest'
import { formatSize } from '../../src/utils/format'

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
