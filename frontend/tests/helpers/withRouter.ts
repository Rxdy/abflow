import { defineComponent, h } from 'vue'
import { render } from '@testing-library/vue'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'

export function setupWithRouter<T>(useComposable: () => T): { result: T; router: Router } {
  let result!: T
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'login', component: { template: '<div>login</div>' } },
      { path: '/files', name: 'files', component: { template: '<div>files</div>' } },
      { path: '/upload', name: 'upload', component: { template: '<div>upload</div>' } },
    ],
  })

  const Host = defineComponent({
    setup() {
      result = useComposable()
      return () => h('div')
    },
  })

  render(Host, { global: { plugins: [router] } })
  return { result, router }
}
