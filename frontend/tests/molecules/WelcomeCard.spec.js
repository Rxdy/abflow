import { render } from '@testing-library/vue'
import WelcomeCard from '../../src/components/molecules/WelcomeCard.vue'

describe('WelcomeCard', () => {
  it('renders the welcome message and feature list', () => {
    const { getByText } = render(WelcomeCard)

    getByText('Bienvenue sur ABFlow')
    getByText('Composants atomiques réutilisables')
    getByText('docker compose up --build')
  })
})
