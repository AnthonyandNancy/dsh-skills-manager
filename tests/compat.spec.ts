import { describe, expect, it, vi } from 'vitest'
import { hasMethod, isClientContextCompatible, readHostDescription, subscribeHostDescription } from '../src/client/compat.ts'

describe('DSH client compatibility helpers', () => {
  it('detects methods without throwing on missing services', () => {
    expect(hasMethod(undefined, 'register')).toBe(false)
    expect(hasMethod({}, 'register')).toBe(false)
    expect(hasMethod({ register() {} }, 'register')).toBe(true)
  })

  it('reads and subscribes to host descriptions only when supported', () => {
    const unsubscribe = vi.fn()
    const source = { getSnapshot: () => ({ canOpenPath: true }), subscribe: vi.fn(() => unsubscribe) }
    expect(readHostDescription(source)).toEqual({ canOpenPath: true })
    expect(subscribeHostDescription(source, () => {})).toBe(unsubscribe)
    expect(readHostDescription(undefined)).toBeUndefined()
    expect(subscribeHostDescription({}, () => {})).toBeUndefined()
  })

  it('recognizes the client services required by the settings entry', () => {
    const ctx = {
      effect() {},
      locale: { register() {}, bind() {} },
      slots: { inject() {}, register() {} },
    }
    expect(isClientContextCompatible(ctx)).toBe(true)
    expect(isClientContextCompatible({ ...ctx, slots: {} })).toBe(false)
  })
})
