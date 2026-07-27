import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/vue'
import AppFooter from '../../src/components/AppFooter.vue'

afterEach(() => { cleanup(); vi.unstubAllEnvs() })

describe('AppFooter', () => {
  it('shows the app name and the current year', () => {
    render(AppFooter)
    expect(screen.getByText('AbFlow')).toBeTruthy()
    expect(screen.getByText(new RegExp(String(new Date().getFullYear())))).toBeTruthy()
  })

  it('uses VITE_APP_NAME when set', () => {
    vi.stubEnv('VITE_APP_NAME', 'MonCloud')
    render(AppFooter)
    expect(screen.getByText('MonCloud')).toBeTruthy()
  })
})
