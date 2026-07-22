import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/vue'
import AppFooter from '../../src/components/AppFooter.vue'

describe('AppFooter', () => {
  it('shows the app name and the current year', () => {
    render(AppFooter)
    expect(screen.getByText('AbFlow')).toBeTruthy()
    expect(screen.getByText(new RegExp(String(new Date().getFullYear())))).toBeTruthy()
  })
})
