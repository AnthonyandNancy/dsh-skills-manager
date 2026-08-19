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
 */

import type { ExternalSkillCandidate, ImportReportItem } from '../types.ts'

export interface ExistingSkillSnapshot {
  readonly name: string
  readonly path?: string
  readonly fingerprint?: string
}

export interface DeduplicateResult {
  readonly items: ImportReportItem[]
  /** Unique candidates that should be considered for import. */
  readonly toImport: ExternalSkillCandidate[]
  /** Unique candidates that are in conflict and must wait for user resolution. */
  readonly conflicts: ExternalSkillCandidate[]
}

function item(
  candidate: ExternalSkillCandidate,
  result: ImportReportItem['result'],
  reason: string,
  importedSkillId?: string,
): ImportReportItem {
  return {
    source: candidate.source,
    skill: candidate.name,
    path: candidate.skillPath,
    result,
    reason,
    fingerprint: candidate.fingerprint,
    ...importedSkillId === undefined ? {} : { importedSkillId },
  }
}

/**
 * Deduplicate candidates against each other and against DSH's existing skills.
 */
export function deduplicateCandidates(
  candidates: readonly ExternalSkillCandidate[],
  existing: readonly ExistingSkillSnapshot[],
): DeduplicateResult {
  const items: ImportReportItem[] = []
  const byCanonical = new Map<string, ExternalSkillCandidate>()
  const byFingerprint = new Map<string, ExternalSkillCandidate>()
  const unique: ExternalSkillCandidate[] = []

  // First pass: remove physical/content duplicates.
  for (const candidate of candidates) {
    const canonicalPrevious = byCanonical.get(candidate.canonicalPath)
    if (canonicalPrevious !== undefined) {
      items.push(item(candidate, 'duplicate', `same physical skill as ${canonicalPrevious.source}/${canonicalPrevious.name}`))
      continue
    }
    const fingerprintPrevious = byFingerprint.get(candidate.fingerprint)
    if (fingerprintPrevious !== undefined) {
      items.push(item(candidate, 'duplicate', `identical content to ${fingerprintPrevious.source}/${fingerprintPrevious.name}`))
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

  for (const [name, group] of groups) {
    const fingerprints = new Set(group.map(candidate => candidate.fingerprint))
    if (fingerprints.size > 1) {
      // Same name, different content: never auto-import, never overwrite.
      for (const candidate of group) {
        const reason = `same-name-different-content among external sources (${group.map(c => c.source).join(', ')})`
        items.push(item(candidate, 'conflict', reason))
        conflicts.push(candidate)
      }
      continue
    }

    const candidate = group[0]!
    const existingByFp = candidate.fingerprint === undefined
      ? undefined
      : existingByFingerprint.get(candidate.fingerprint)
    if (existingByFp !== undefined) {
      items.push(item(candidate, 'duplicate', `DSH already has identical skill "${existingByFp.name}"`))
      continue
    }

    const existingByNameEntry = existingByName.get(name)
    if (existingByNameEntry !== undefined && existingByNameEntry.fingerprint !== candidate.fingerprint) {
      items.push(item(candidate, 'conflict', `DSH already has skill "${name}" with different content`))
      conflicts.push(candidate)
      continue
    }

    items.push(item(candidate, 'new', 'ready to import'))
    toImport.push(candidate)
  }

  return { items, toImport, conflicts }
}
