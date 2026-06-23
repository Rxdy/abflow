import { render } from '@testing-library/vue'
import SectionHeading from '../../src/components/atoms/SectionHeading.vue'

describe('SectionHeading', () => {
  it('renders title and subtitle', () => {
    const { getByText } = render(SectionHeading, {
      props: {
        title: 'Titre test',
        subtitle: 'Sous-titre test'
      }
    })

    getByText('Titre test')
    getByText('Sous-titre test')
  })
})
