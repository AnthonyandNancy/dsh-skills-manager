import { describe, expect, it, vi } from 'vitest'
import {
  hasMethod,
  hostDescriptionSourceOf,
  isClientContextCompatible,
  readConnectionState,
  readHostDescription,
  resolveChevronDownIcon,
  subscribeConnectionState,
  subscribeHostDescription,
  transportUnavailable,
} from '../src/client/compat.ts'

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

  it('reads and subscribes to the transport state only when the release exposes it', () => {
    const unsubscribe = vi.fn()
    const source = { getSnapshot: () => 'connected', subscribe: vi.fn(() => unsubscribe) }
    expect(readConnectionState(source)).toBe('connected')
    expect(subscribeConnectionState(source, () => {})).toBe(unsubscribe)
    expect(readConnectionState({ getSnapshot: () => undefined })).toBeUndefined()
    expect(readConnectionState({ getSnapshot: () => 'reticulating' })).toBeUndefined()
    expect(readConnectionState(undefined)).toBeUndefined()
    expect(subscribeConnectionState({}, () => {})).toBeUndefined()
  })

  it('resolves the chevron-down glyph across releases, degrading to no icon', () => {
    const medium = () => null
    const regular = () => null
    const legacy = () => null

    // 0.1.7: a two-weight set drawn on a 16px grid.
    expect(resolveChevronDownIcon({ IconChevronDownOutlineMedium: medium, IconChevronDownOutlineRegular: regular })).toBe(medium)
    expect(resolveChevronDownIcon({ IconChevronDownOutlineRegular: regular })).toBe(regular)
    // ≤0.1.6: the size-suffixed glyph.
    expect(resolveChevronDownIcon({ IconChevronDownOutline14: legacy })).toBe(legacy)
    // A kit that offers none, or no kit at all, renders the seat without a glyph.
    expect(resolveChevronDownIcon({ IconChevronDownOutlineMedium: 'not-a-component' })).toBeUndefined()
    expect(resolveChevronDownIcon({})).toBeUndefined()
    expect(resolveChevronDownIcon(undefined)).toBeUndefined()
  })

  it('reads the ≤0.1.4 host-description source off a connection that no longer declares it', () => {
    const source = { getSnapshot: () => ({ canOpenPath: true }) }
    expect(hostDescriptionSourceOf({ hostDescription: source })).toBe(source)
    expect(hostDescriptionSourceOf({})).toBeUndefined()
    expect(hostDescriptionSourceOf(undefined)).toBeUndefined()
  })

  it('treats an unreachable transport as unavailable, and a release without the state as unknown', () => {
    const withState = (state: unknown) => ({ state: { getSnapshot: () => state, subscribe: () => () => {} } })
    expect(transportUnavailable(undefined)).toBe(false)
    expect(transportUnavailable({})).toBe(false)
    expect(transportUnavailable(withState('disconnected'))).toBe(true)
    expect(transportUnavailable(withState('connecting'))).toBe(true)
    expect(transportUnavailable(withState(undefined))).toBe(true)
    expect(transportUnavailable(withState('connected'))).toBe(false)
  })
})
