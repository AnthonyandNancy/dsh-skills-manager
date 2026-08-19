/**
 * External Skills import pipeline.
 *
 * Pipeline: discover → normalize → deduplicate → compare with DSH →
 * detect conflicts → import new skills → return ImportReport.
 *
 * The importer is a one-shot bridge into DSH's native skills filesystem. It
 * writes only into DSH's managed user skills directory (`$DSH_HOME/skills`),
 * never into Claude/Codex/Cursor/Gemini source directories. All runtime
 * loading, watching, and invocation afterwards is owned by DSH.
 */

import { cp, copyFile, mkdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { ExternalSkillCandidate, ImportReport, ImportMetadataRecord } from '../types.ts'
import type { MetadataStore } from '../storage.ts'
import { createSkillAccess } from '../skills-access.ts'
import { discoverExternalSkills } from './scanner.ts'
import { deduplicateCandidates, type ExistingSkillSnapshot } from './deduplicator.ts'
import { fingerprintSkillPath } from './fingerprint.ts'
import { externalSources } from './sources/index.ts'

/** Minimal shape of DSH native skill summary used for dedup. */
export interface SkillSummaryLike {
  readonly name: string
  readonly description: string
  readonly whenToUse?: string
  readonly source: string
  readonly provider: string
  readonly invocation: { readonly modelInvocable: boolean; readonly userInvocable: boolean }
}

export interface ImportServices {
  /** DSH context; `skills` and `logger` are accessed structurally. */
  readonly ctx: { get?: (name: string) => any; skills?: any; logger?: { info?: (...args: any[]) => void; warn?: (...args: any[]) => void }; emit?: (event: string, ...args: any[]) => void }
  readonly metadata: MetadataStore
  readonly dshHome?: string
}

export function resolveDshSkillsRoot(dshHome?: string): string {
  return join(dshHome ?? process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'skills')
}

/** Compute DSH existing skill snapshots for dedup. */
export async function existingSkillSnapshots(
  ctx: ImportServices['ctx'],
  cwd?: string,
): Promise<ExistingSkillSnapshot[]> {
  let skills
  try {
    skills = await createSkillAccess(ctx)
  } catch (error) {
    ctx.logger?.warn?.('[dsh-skills-manager] DSH skills service unavailable; skipping existing-skill dedup: %s', String(error))
    return []
  }
  let summaries: SkillSummaryLike[]
  try {
    summaries = await skills.list({ cwd })
  } catch (error) {
    ctx.logger?.warn?.('[dsh-skills-manager] failed to list DSH skills for dedup: %s', String(error))
    return []
  }

  const out: ExistingSkillSnapshot[] = []
  for (const summary of summaries) {
    let path: string | undefined
    try {
      const definition = await skills.get(summary.name, { cwd })
      path = definition?.path
    } catch {
      path = undefined
    }
    let fingerprint: string | undefined
    if (path !== undefined) {
      try {
        const skillPath = path.endsWith('SKILL.md') ? dirname(path) : path
        fingerprint = await fingerprintSkillPath(skillPath)
      } catch {
        fingerprint = undefined
      }
    }
    out.push({ name: summary.name, path, fingerprint })
  }
  return out
}

/** Thrown when the DSH managed target already exists and must not be overwritten. */
export class SkillTargetExistsError extends Error {
  constructor(
    readonly target: string,
    readonly conflict: boolean,
    message: string,
  ) {
    super(message)
    this.name = 'SkillTargetExistsError'
  }
}

/** Copy one external candidate into DSH's managed user skills root. */
export async function importCandidate(
  candidate: ExternalSkillCandidate,
  dshSkillsRoot: string,
): Promise<string> {
  await mkdir(dshSkillsRoot, { recursive: true })
  const info = await stat(candidate.skillPath)
  const isDirectory = info.isDirectory()
  const target = isDirectory
    ? join(dshSkillsRoot, candidate.name)
    : join(dshSkillsRoot, `${candidate.name}.md`)

  // Never overwrite an existing DSH skill, even when the live registry cache
  // has not yet observed the managed directory. Compare fingerprints so an
  // identical re-import is a no-op and a different body is a conflict.
  let targetInfo
  try {
    targetInfo = await stat(target)
  } catch {
    targetInfo = undefined
  }
  if (targetInfo !== undefined) {
    const existingFingerprint = await fingerprintSkillPath(target)
    if (existingFingerprint === candidate.fingerprint) {
      throw new SkillTargetExistsError(target, false, `target already exists and is identical: ${target}`)
    }
    throw new SkillTargetExistsError(target, true, `target already exists with different content: ${target}`)
  }

  if (isDirectory) {
    await cp(candidate.skillPath, target, { recursive: true, errorOnExist: false, force: false })
  } else {
    await copyFile(candidate.skillPath, target)
  }
  return target
}

/**
 * Run the complete external import pipeline. It is idempotent: DSH existing
 * skills are compared by fingerprint/name, so re-running never duplicates.
 */
export async function runExternalImport(services: ImportServices, cwd?: string): Promise<ImportReport> {
  const { ctx, metadata } = services
  const startedAt = new Date().toISOString()
  const discovered = await discoverExternalSkills(externalSources, cwd)
  const existing = await existingSkillSnapshots(ctx, cwd)
  const dedup = deduplicateCandidates(discovered.candidates, existing)

  const dshSkillsRoot = resolveDshSkillsRoot(services.dshHome)
  const items = [...dedup.items]
  const importedIds: string[] = []

  for (const candidate of dedup.toImport) {
    try {
      const target = await importCandidate(candidate, dshSkillsRoot)
      importedIds.push(target)
      // Replace the 'new' item with one carrying the imported location.
      const index = items.findIndex(item => item.path === candidate.skillPath && item.result === 'new')
      if (index >= 0) {
        items[index] = {
          ...items[index]!,
          result: 'new',
          reason: `imported to ${target}`,
          importedSkillId: candidate.name,
        }
      }
    } catch (error) {
      const index = items.findIndex(item => item.path === candidate.skillPath && item.result === 'new')
      if (index >= 0) {
        if (error instanceof SkillTargetExistsError) {
          items[index] = {
            ...items[index]!,
            result: error.conflict ? 'conflict' : 'duplicate',
            reason: error.conflict
              ? `target already exists in DSH skills with different content; not overwritten: ${error.target}`
              : `already present in DSH skills (identical fingerprint): ${error.target}`,
            importedSkillId: candidate.name,
          }
        } else {
          items[index] = {
            ...items[index]!,
            result: 'invalid',
            reason: `import failed: ${error instanceof Error ? error.message : String(error)}`,
          }
        }
      }
    }
  }

  const allItems = [...discovered.invalid, ...items]
  const report: ImportReport = {
    scanned: allItems.length,
    imported: allItems.filter(item => item.result === 'new').length,
    duplicates: allItems.filter(item => item.result === 'duplicate' || item.result === 'skipped').length,
    conflicts: allItems.filter(item => item.result === 'conflict').length,
    invalid: allItems.filter(item => item.result === 'invalid').length,
    skipped: allItems.filter(item => item.result === 'skipped').length,
    items: allItems,
    startedAt,
    finishedAt: new Date().toISOString(),
  }

  // Persist lightweight import metadata only.
  const records: ImportMetadataRecord[] = allItems.map(item => ({
    source: item.source,
    originalPath: item.path,
    canonicalPath: item.path,
    fingerprint: item.fingerprint ?? '',
    name: item.skill,
    result: item.result,
    ...item.importedSkillId === undefined ? {} : { importedSkillId: item.importedSkillId },
    reason: item.reason,
  }))
  const previous = metadata.get()
  await metadata.save({
    externalImportCompleted: true,
    lastScanAt: report.finishedAt,
    records: [...previous.records.filter(record => record.result !== 'new' && record.result !== 'conflict'), ...records],
  })

  // Best-effort notification: DSH's filesystem watcher is the primary signal,
  // but an explicit event helps consumers that are not watching this root.
  try {
    ctx.emit?.('skills/change')
  } catch {
    // The event is an optional hint; watchers are authoritative.
  }

  return report
}

/** Build a report from stored metadata for UI display without rescanning. */
export function reportFromMetadata(metadata: ImportMetadataStoreLike): ImportReport | undefined {
  const meta = metadata.get()
  if (meta.lastScanAt === undefined) return undefined
  const items = meta.records.map(record => ({
    source: record.source,
    skill: record.name,
    path: record.originalPath,
    result: record.result,
    reason: record.reason,
    ...record.fingerprint === '' ? {} : { fingerprint: record.fingerprint },
    ...record.importedSkillId === undefined ? {} : { importedSkillId: record.importedSkillId },
  }))
  return {
    scanned: items.length,
    imported: items.filter(item => item.result === 'new').length,
    duplicates: items.filter(item => item.result === 'duplicate' || item.result === 'skipped').length,
    conflicts: items.filter(item => item.result === 'conflict').length,
    invalid: items.filter(item => item.result === 'invalid').length,
    skipped: items.filter(item => item.result === 'skipped').length,
    items,
    startedAt: meta.lastScanAt,
    finishedAt: meta.lastScanAt,
  }
}

interface ImportMetadataStoreLike {
  get(): { lastScanAt?: string; records: readonly ImportMetadataRecord[] }
}
