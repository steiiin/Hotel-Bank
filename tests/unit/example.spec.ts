import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HomePage from '@/views/HomePage.vue'
import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

describe('HomePage.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  test('renders home vue', () => {
    const wrapper = mount(HomePage, {
      global: {
        plugins: [createPinia()],
      },
    })
    expect(wrapper.text()).toMatch('Hotel-Bank')
    expect(wrapper.text()).toMatch('Ich bin die Bank')
  })
})
