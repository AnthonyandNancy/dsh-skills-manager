import { describe, expect, it } from 'vitest'
import { deduplicateCandidates } from '../src/import/deduplicator.ts'
import type { ExternalSkillCandidate } from '../src/types.ts'

function candidate(partial: Partial<ExternalSkillCandidate> & { source: ExternalSkillCandidate['source']; name: string }): ExternalSkillCandidate {
  return {
    rootPath: '/root',
    skillPath: `/skills/${partial.name}`,
    skillMdPath: `/skills/${partial.name}/SKILL.md`,
    canonicalPath: `/canonical/${partial.name}`,
    description: 'desc',
    fingerprint: `fp-${partial.name}`,
    ...partial,
  }
}

describe('deduplicator', () => {
  it('Case 1: same realpath scanned twice -> 1 unique skill', () => {
    const a = candidate({ source: 'claude', name: 'foo', canonicalPath: '/same', fingerprint: 'fp-a' })
    const b = candidate({ source: 'codex', name: 'foo', canonicalPath: '/same', fingerprint: 'fp-b' })
    const result = deduplicateCandidates([a, b], [])
    expect(result.toImport).toHaveLength(1)
    expect(result.items.filter(i => i.result === 'duplicate')).toHaveLength(1)
  })

  it('Case 2: same content from Claude and Codex -> imported 1, duplicate 1', () => {
    const a = candidate({ source: 'claude', name: 'foo', fingerprint: 'same' })
    const b = candidate({ source: 'codex', name: 'foo', fingerprint: 'same' })
    const result = deduplicateCandidates([a, b], [])
    expect(result.toImport).toHaveLength(1)
    expect(result.items.filter(i => i.result === 'duplicate')).toHaveLength(1)
  })

  it('Case 3: three identical copies -> only one imported', () => {
    const a = candidate({ source: 'claude', name: 'foo', fingerprint: 'same' })
    const b = candidate({ source: 'codex', name: 'foo', fingerprint: 'same' })
    const c = candidate({ source: 'cursor', name: 'foo', fingerprint: 'same' })
    const result = deduplicateCandidates([a, b, c], [])
    expect(result.toImport).toHaveLength(1)
    expect(result.items.filter(i => i.result === 'duplicate')).toHaveLength(2)
  })

  it('Case 4: same name different content -> conflict, no import', () => {
    const a = candidate({ source: 'claude', name: 'foo', canonicalPath: '/canonical/a', fingerprint: 'fp-a' })
    const b = candidate({ source: 'codex', name: 'foo', canonicalPath: '/canonical/b', fingerprint: 'fp-b' })
    const result = deduplicateCandidates([a, b], [])
    expect(result.toImport).toHaveLength(0)
    expect(result.conflicts).toHaveLength(2)
    expect(result.items.filter(i => i.result === 'conflict')).toHaveLength(2)
  })

  it('Case 5: DSH already has same name+content -> duplicate/skipped', () => {
    const a = candidate({ source: 'claude', name: 'foo', fingerprint: 'same' })
    const result = deduplicateCandidates([a], [{ name: 'foo', fingerprint: 'same' }])
    expect(result.toImport).toHaveLength(0)
    expect(result.items[0]?.result).toBe('duplicate')
  })

  it('Case 6: DSH already has same name different content -> conflict, DSH untouched', () => {
    const a = candidate({ source: 'claude', name: 'foo', fingerprint: 'external-fp' })
    const result = deduplicateCandidates([a], [{ name: 'foo', fingerprint: 'dsh-fp' }])
    expect(result.toImport).toHaveLength(0)
    expect(result.conflicts).toHaveLength(1)
    expect(result.items[0]?.result).toBe('conflict')
  })

  it('Case 7: same SKILL.md but different scripts -> different fingerprints -> conflict when same name', () => {
    const a = candidate({ source: 'claude', name: 'foo', canonicalPath: '/canonical/a', fingerprint: 'fp-a' })
    const b = candidate({ source: 'codex', name: 'foo', canonicalPath: '/canonical/b', fingerprint: 'fp-b' })
    const result = deduplicateCandidates([a, b], [])
    expect(result.toImport).toHaveLength(0)
    expect(result.conflicts).toHaveLength(2)
  })

  it('Case 8: running twice against the same DSH existing skill does not create duplicates', () => {
    const a = candidate({ source: 'claude', name: 'foo', fingerprint: 'same' })
    const first = deduplicateCandidates([a], [])
    expect(first.toImport).toHaveLength(1)
    // After import, DSH has the same fingerprint.
    const second = deduplicateCandidates([a], [{ name: 'foo', fingerprint: 'same' }])
    expect(second.toImport).toHaveLength(0)
    expect(second.items[0]?.result).toBe('duplicate')
  })
})
