import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HomePage from '@/views/HomePage.vue'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
  hostSession: {
    startHostSession: vi.fn(),
    resumeHostSession: vi.fn(),
    hasHostSession: { value: false },
    canReplaceHostSession: { value: true },
    hostSessionError: { value: '' },
  },
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mocks.routerPush,
  }),
}))

vi.mock('@/composables/useHostGameSession', () => ({
  useHostGameSession: () => mocks.hostSession,
}))

describe('HomePage.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.hostSession.hasHostSession.value = false
    mocks.hostSession.canReplaceHostSession.value = true
    mocks.hostSession.hostSessionError.value = ''
    mocks.hostSession.startHostSession.mockResolvedValue(false)
    mocks.hostSession.resumeHostSession.mockResolvedValue(false)
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

  test('resumes an existing bank session before creating a new one', async () => {
    mocks.hostSession.resumeHostSession.mockResolvedValueOnce(true)
    const wrapper = mount(HomePage, {
      global: {
        plugins: [createPinia()],
      },
    })

    await expect((wrapper.vm as any).handleBankPasswordConfirmed({ password: 'secret' })).resolves.toBe(true)

    expect(mocks.hostSession.resumeHostSession).toHaveBeenCalledWith('secret')
    expect(mocks.hostSession.startHostSession).not.toHaveBeenCalled()
    expect(mocks.routerPush).toHaveBeenCalledWith({ name: 'Bank' })
  })

  test('creates a new bank session when no existing session matches', async () => {
    mocks.hostSession.resumeHostSession.mockResolvedValueOnce(false)
    mocks.hostSession.startHostSession.mockResolvedValueOnce(true)
    const wrapper = mount(HomePage, {
      global: {
        plugins: [createPinia()],
      },
    })

    await expect((wrapper.vm as any).handleBankPasswordConfirmed({ password: 'secret' })).resolves.toBe(true)

    expect(mocks.hostSession.resumeHostSession).toHaveBeenCalledWith('secret')
    expect(mocks.hostSession.startHostSession).toHaveBeenCalledWith('secret')
    expect(mocks.routerPush).toHaveBeenCalledWith({ name: 'Bank' })
  })
})
