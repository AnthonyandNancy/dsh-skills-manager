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

  it('names the summary metrics by their statistical unit', () => {
    // "已在 DSH" must never read as "已导入": the headline number is the count
    // of unique external skills DSH currently represents, not this scan's delta.
    expect(zh['import.summary.scanned']).toBe('扫描候选')
    expect(zh['import.summary.inDsh']).toBe('已在 DSH')
    expect(zh['import.summary.deduplicated']).toBe('去重副本')
    expect(en['import.summary.scanned']).toBe('Scanned')
    expect(en['import.summary.inDsh']).toBe('In DSH')
    expect(en['import.summary.deduplicated']).toBe('Deduplicated')
    expect(zh['import.details.importedThisScan']).toBe('本次新增')
    expect(en['import.details.importedThisScan']).toBe('Imported this scan')
    expect(zh['import.details.uniqueValid']).toBe('唯一有效技能')
    expect(en['import.details.uniqueValid']).toBe('Unique valid skills')
    // The mixed-unit disclaimer keeps users from adding the cards together.
    expect(zh['import.unitNote']).toContain('唯一技能')
    expect(en['import.unitNote']).toContain('unique skills')
  })

  it('no longer labels any metric as a plain "imported" total', () => {
    expect(Object.keys(zh)).not.toContain('import.summary.imported')
    expect(Object.keys(zh)).not.toContain('import.summary.duplicates')
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
