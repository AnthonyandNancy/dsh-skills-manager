import { describe, expect, it } from 'vitest'
import { en, SKILLS_MANAGER_NS, zh } from '../src/client/locale.ts'
import { hasCollapsedOverflow } from '../src/client/overflow.ts'

describe('Skills Manager locale', () => {
  it('owns a bilingual namespace with a balanced key set', () => {
    expect(SKILLS_MANAGER_NS).toBe('dsh-skills-manager')
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())
    expect(zh['nav.title']).toBe('技能')
    expect(en['nav.title']).toBe('Skills')
    expect(zh['text.expand']).toBe('展开')
    expect(en['text.expand']).toBe('More')
  })
})

describe('ExpandableText overflow contract', () => {
  it('does not expose a toggle at or below the collapsed height', () => {
    expect(hasCollapsedOverflow(40, 40)).toBe(false)
    expect(hasCollapsedOverflow(41, 40)).toBe(false)
  })

  it('exposes a toggle only when the rendered content exceeds it', () => {
    expect(hasCollapsedOverflow(43, 40)).toBe(true)
  })
})
