/**
 * Deduplication and conflict detection for external skill candidates.
 *
 * This implements the required three layers:
 * 1. canonical realpath equality
 * 2. content fingerprint equality
 * 3. name equality with different fingerprints => conflict
 *
 * It also compares against DSH's existing native skills, which always have
 * highest protection: identical content is skipped, same-name-different-content
 * is a conflict and is never overwritten automatically.
 *
 * The result deliberately keeps per-candidate records (`items`) so the UI can
 * show candidate-level reasons, and adds group-level metrics so the UI can
 * distinguish “filtered candidate copies” from “unique logical skills”.
 */

import type {
  DuplicateBreakdown,
  DuplicateGroup,
  DuplicateReason,
  ExternalSkillCandidate,
  ExternalSourceId,
  ImportReportItem,
  ImportStatus,
} from '../types.ts'

export interface ExistingSkillSnapshot {
  readonly name: string
  readonly path?: string
  readonly fingerprint?: string
  readonly source?: string
  readonly provider?: string
}

export interface DeduplicateResult {
  readonly items: ImportReportItem[]
  /** Unique candidates that should be considered for import. */
  readonly toImport: ExternalSkillCandidate[]
  /** Unique candidates that are in conflict and must wait for user resolution. */
  readonly conflicts: ExternalSkillCandidate[]
  /** Number of unique logical skills after external-to-external dedup. */
  readonly uniqueValidSkills: number
  /**
   * Unique logical skills already represented in DSH by exact content before
   * any import ran this scan. Counted per unique skill, never per copy.
   */
  readonly alreadyInDsh: number
  /** Conflicting unique logical skills, grouped by name. */
  readonly conflictGroups: number
  /** Candidate-copy-level duplicate reason counts. */
  readonly duplicateBreakdown: DuplicateBreakdown
}

interface MutableItem extends ImportReportItem {
  duplicateReason?: DuplicateReason
  groupKey?: string
  importStatus?: ImportStatus
}

function item(
  candidate: ExternalSkillCandidate,
  result: ImportReportItem['result'],
  reason: string,
  importedSkillId?: string,
  extra: { duplicateReason?: DuplicateReason; groupKey?: string; importStatus?: ImportStatus } = {},
): MutableItem {
  return {
    source: candidate.source,
    skill: candidate.name,
    path: candidate.skillPath,
    result,
    reason,
    fingerprint: candidate.fingerprint,
    ...importedSkillId === undefined ? {} : { importedSkillId },
    ...extra.duplicateReason === undefined ? {} : { duplicateReason: extra.duplicateReason },
    ...extra.groupKey === undefined ? {} : { groupKey: extra.groupKey },
    ...extra.importStatus === undefined ? {} : { importStatus: extra.importStatus },
  }
}

function groupKeyFor(name: string, fingerprint?: string): string {
  return fingerprint === undefined || fingerprint.length === 0 ? `name:${name}` : `fp:${fingerprint}`
}

function nameGroupKey(name: string): string {
  return `name:${name}`
}

/**
 * Deduplicate candidates against each other and against DSH's existing skills.
 */
export function deduplicateCandidates(
  candidates: readonly ExternalSkillCandidate[],
  existing: readonly ExistingSkillSnapshot[],
): DeduplicateResult {
  const items: MutableItem[] = []
  const pendingDuplicates: { item: MutableItem; representative: ExternalSkillCandidate }[] = []
  const byCanonical = new Map<string, ExternalSkillCandidate>()
  const byFingerprint = new Map<string, ExternalSkillCandidate>()
  const unique: ExternalSkillCandidate[] = []

  // First pass: remove physical/content duplicates.
  for (const candidate of candidates) {
    const canonicalPrevious = byCanonical.get(candidate.canonicalPath)
    if (canonicalPrevious !== undefined) {
      const duplicate = item(candidate, 'duplicate', `same physical skill as ${canonicalPrevious.source}/${canonicalPrevious.name}`, undefined, {
        duplicateReason: 'same-canonical-path',
      })
      items.push(duplicate)
      pendingDuplicates.push({ item: duplicate, representative: canonicalPrevious })
      continue
    }
    const fingerprintPrevious = byFingerprint.get(candidate.fingerprint)
    if (fingerprintPrevious !== undefined) {
      const duplicate = item(candidate, 'duplicate', `identical content to ${fingerprintPrevious.source}/${fingerprintPrevious.name}`, undefined, {
        duplicateReason: 'same-external-fingerprint',
      })
      items.push(duplicate)
      pendingDuplicates.push({ item: duplicate, representative: fingerprintPrevious })
      continue
    }
    byCanonical.set(candidate.canonicalPath, candidate)
    byFingerprint.set(candidate.fingerprint, candidate)
    unique.push(candidate)
  }

  const existingByName = new Map<string, ExistingSkillSnapshot>()
  const existingByFingerprint = new Map<string, ExistingSkillSnapshot>()
  for (const snap of existing) {
    existingByName.set(snap.name, snap)
    if (snap.fingerprint !== undefined) existingByFingerprint.set(snap.fingerprint, snap)
  }

  // Second pass: group unique candidates by name to detect cross-source conflicts.
  const groups = new Map<string, ExternalSkillCandidate[]>()
  for (const candidate of unique) {
    const group = groups.get(candidate.name) ?? []
    group.push(candidate)
    groups.set(candidate.name, group)
  }

  const toImport: ExternalSkillCandidate[] = []
  const conflicts: ExternalSkillCandidate[] = []
  const uniqueGroupKeys = new Set<string>()
  const representativeGroupKey = new Map<ExternalSkillCandidate, string>()
  let alreadyInDsh = 0
  let conflictGroups = 0

  for (const [name, group] of groups) {
    const fingerprints = new Set(group.map(candidate => candidate.fingerprint))
    if (fingerprints.size > 1) {
      // Same name, different content: never auto-import, never overwrite.
      const groupKey = nameGroupKey(name)
      uniqueGroupKeys.add(groupKey)
      conflictGroups += 1
      for (const candidate of group) {
        const reason = `same-name-different-content among external sources (${group.map(c => c.source).join(', ')})`
        const conflictItem = item(candidate, 'conflict', reason, undefined, { groupKey, importStatus: 'not-needed' })
        items.push(conflictItem)
        representativeGroupKey.set(candidate, groupKey)
        conflicts.push(candidate)
      }
      continue
    }

    const candidate = group[0]!
    const existingByFp = candidate.fingerprint === undefined
      ? undefined
      : existingByFingerprint.get(candidate.fingerprint)
    if (existingByFp !== undefined) {
      const groupKey = groupKeyFor(name, candidate.fingerprint)
      uniqueGroupKeys.add(groupKey)
      alreadyInDsh += 1
      const duplicate = item(candidate, 'duplicate', `DSH already has identical skill "${existingByFp.name}"`, undefined, {
        duplicateReason: 'already-in-dsh',
        groupKey,
        importStatus: 'not-needed',
      })
      items.push(duplicate)
      representativeGroupKey.set(candidate, groupKey)
      continue
    }

    const existingByNameEntry = existingByName.get(name)
    if (existingByNameEntry !== undefined && existingByNameEntry.fingerprint !== candidate.fingerprint) {
      const groupKey = nameGroupKey(name)
      uniqueGroupKeys.add(groupKey)
      conflictGroups += 1
      const conflictItem = item(candidate, 'conflict', `DSH already has skill "${name}" with different content`, undefined, {
        groupKey,
        importStatus: 'not-needed',
      })
      items.push(conflictItem)
      representativeGroupKey.set(candidate, groupKey)
      conflicts.push(candidate)
      continue
    }

    const groupKey = groupKeyFor(name, candidate.fingerprint)
    uniqueGroupKeys.add(groupKey)
    const newItem = item(candidate, 'new', 'ready to import', undefined, { groupKey })
    items.push(newItem)
    representativeGroupKey.set(candidate, groupKey)
    toImport.push(candidate)
  }

  // Backfill group keys for first-pass duplicate copies now that their
  // representative's final logical group is known.
  for (const pending of pendingDuplicates) {
    const groupKey = representativeGroupKey.get(pending.representative)
    if (groupKey !== undefined) {
      pending.item.groupKey = groupKey
    } else {
      pending.item.groupKey = groupKeyFor(pending.representative.name, pending.representative.fingerprint)
    }
  }

  const duplicateBreakdown: DuplicateBreakdown = {
    samePath: items.filter(i => i.result === 'duplicate' && i.duplicateReason === 'same-canonical-path').length,
    sameContent: items.filter(i => i.result === 'duplicate' && i.duplicateReason === 'same-external-fingerprint').length,
    alreadyInDsh: items.filter(i => i.result === 'duplicate' && i.duplicateReason === 'already-in-dsh').length,
  }

  return {
    items: items as ImportReportItem[],
    toImport,
    conflicts,
    uniqueValidSkills: uniqueGroupKeys.size,
    alreadyInDsh,
    conflictGroups,
    duplicateBreakdown,
  }
}

/**
 * Build duplicate detail groups from a final report item list.
 *
 * One group is one unique logical skill, so N external copies of the same
 * skill appear as one row with N sources instead of N unrelated rows.
 */
export function buildDuplicateGroups(items: readonly ImportReportItem[]): DuplicateGroup[] {
  const groups = new Map<string, {
    key: string
    name: string
    fingerprint?: string
    inDsh: boolean
    importedThisScan: boolean
    sources: { source: ExternalSourceId; path: string }[]
    candidateCount: number
    filteredCopies: number
  }>()

  for (const item of items) {
    if (item.groupKey === undefined) continue
    let group = groups.get(item.groupKey)
    if (group === undefined) {
      group = {
        key: item.groupKey,
        name: item.skill,
        ...item.fingerprint === undefined ? {} : { fingerprint: item.fingerprint },
        inDsh: false,
        importedThisScan: false,
        sources: [],
        candidateCount: 0,
        filteredCopies: 0,
      }
      groups.set(item.groupKey, group)
    }
    group.fingerprint ??= item.fingerprint
    group.candidateCount += 1
    if (!group.sources.some(source => source.source === item.source && source.path === item.path)) {
      group.sources.push({ source: item.source, path: item.path })
    }
    if (item.result === 'duplicate') {
      group.filteredCopies += 1
      if (item.duplicateReason === 'already-in-dsh') group.inDsh = true
    }
    if (item.importStatus === 'imported') {
      group.inDsh = true
      group.importedThisScan = true
    }
  }

  return [...groups.values()]
}
