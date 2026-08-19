import { describe, expect, it } from 'vitest'
import { buildDuplicateGroups, deduplicateCandidates } from '../src/import/deduplicator.ts'
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

describe('deduplicator group metrics', () => {
  it('counts unique logical skills, not candidate copies', () => {
    const copies = (['claude', 'codex', 'cursor', 'gemini'] as const).map(source =>
      candidate({ source, name: 'brainstorming', canonicalPath: `/canonical/${source}`, fingerprint: 'same' }),
    )
    const other = candidate({ source: 'claude', name: 'other', fingerprint: 'other-fp' })
    const result = deduplicateCandidates([...copies, other], [])
    expect(result.uniqueValidSkills).toBe(2)
    expect(result.items.filter(item => item.result === 'duplicate')).toHaveLength(3)
    expect(result.duplicateBreakdown.sameContent).toBe(3)
    expect(result.duplicateBreakdown.samePath).toBe(0)
  })

  it('attributes duplicate reasons structurally', () => {
    const samePath = [
      candidate({ source: 'claude', name: 'foo', canonicalPath: '/same', fingerprint: 'fp-a' }),
      candidate({ source: 'codex', name: 'foo', canonicalPath: '/same', fingerprint: 'fp-b' }),
    ]
    const result = deduplicateCandidates(samePath, [])
    expect(result.duplicateBreakdown.samePath).toBe(1)
    expect(result.items.find(item => item.result === 'duplicate')?.duplicateReason).toBe('same-canonical-path')
  })

  it('counts alreadyInDsh per unique skill and conflicts per name group', () => {
    const inDsh = candidate({ source: 'claude', name: 'foo', fingerprint: 'same' })
    const conflictA = candidate({ source: 'claude', name: 'bar', canonicalPath: '/c/a', fingerprint: 'fp-a' })
    const conflictB = candidate({ source: 'codex', name: 'bar', canonicalPath: '/c/b', fingerprint: 'fp-b' })
    const result = deduplicateCandidates([inDsh, conflictA, conflictB], [{ name: 'foo', fingerprint: 'same' }])
    expect(result.alreadyInDsh).toBe(1)
    // Two conflicting variants of one name are one conflict group.
    expect(result.conflictGroups).toBe(1)
    expect(result.conflicts).toHaveLength(2)
  })

  it('aggregates copies of one skill into a single duplicate group', () => {
    const copies = (['claude', 'codex', 'cursor'] as const).map(source =>
      candidate({ source, name: 'foo', canonicalPath: `/canonical/${source}`, fingerprint: 'same' }),
    )
    const result = deduplicateCandidates(copies, [])
    const groups = buildDuplicateGroups(result.items)
    expect(groups).toHaveLength(1)
    expect(groups[0]?.candidateCount).toBe(3)
    expect(groups[0]?.filteredCopies).toBe(2)
    expect(groups[0]?.sources.map(source => source.source).sort()).toEqual(['claude', 'codex', 'cursor'])
    // Nothing was imported in this pure-dedup call.
    expect(groups[0]?.inDsh).toBe(false)
  })
})
