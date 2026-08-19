/**
 * Conflict resolution for external import conflicts.
 *
 * The importer never overwrites automatically. This module lets a user
 * explicitly choose one source version; DSH existing skills are replaced only
 * when the user chooses an external version and the existing skill lives in a
 * writable DSH-managed root. External source files are never modified or
 * deleted.
 */

import { cp, copyFile, mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { ConflictCandidate, ConflictView, ExternalSourceId, ImportMetadataRecord } from '../types.ts'
import type { MetadataStore } from '../storage.ts'
import { createSkillAccess } from '../skills-access.ts'
import { assertManagedSkillPath, managedSkillRoots, type ManagedSkillContext } from '../skills-service.ts'
import { resolveDshSkillsRoot } from './importer.ts'
import { sourceLabel } from './sources/index.ts'

export interface ResolveConflictInput {
  readonly name: string
  readonly source: ExternalSourceId
}

/** Group stored conflict records into UI-ready conflict views. */
export function listConflicts(
  metadata: MetadataStore,
  existingSkills: { name: string; path?: string }[],
): ConflictView[] {
  const records = metadata.get().records.filter(record => record.result === 'conflict' && record.resolved !== true)
  const byName = new Map<string, ImportMetadataRecord[]>()
  for (const record of records) {
    const group = byName.get(record.name) ?? []
    group.push(record)
    byName.set(record.name, group)
  }
  const views: ConflictView[] = []
  for (const [name, group] of byName) {
    const candidates: ConflictCandidate[] = group.map(record => ({
      source: record.source,
      label: sourceLabel(record.source),
      path: record.originalPath,
      fingerprint: record.fingerprint,
      name: record.name,
      description: '',
    }))
    const existing = existingSkills.find(skill => skill.name === name)
    views.push({
      name,
      ...existing === undefined ? {} : { existing: { name: existing.name, description: '', source: '', provider: '', ...existing.path === undefined ? {} : { path: existing.path }, modelInvocable: true, userInvocable: true } },
      candidates,
      reason: group[0]?.reason ?? 'same-name-different-content',
    })
  }
  return views
}

/**
 * Resolve one conflict by copying the chosen external version into DSH.
 * When a DSH skill with the same name already exists, it is replaced only at
 * its existing managed location; otherwise the chosen version is imported into
 * the user/global managed root.
 */
export async function resolveConflict(
  ctx: ManagedSkillContext,
  metadata: MetadataStore,
  input: ResolveConflictInput,
  cwd?: string,
): Promise<void> {
  const records = metadata.get().records.filter(record =>
    record.name === input.name && record.result === 'conflict' && record.resolved !== true,
  )
  const chosen = records.find(record => record.source === input.source)
  if (chosen === undefined) {
    throw new Error(`conflict "${input.name}" has no candidate from source "${input.source}"`)
  }

  let definition: { path?: string } | undefined
  try {
    const skills = await createSkillAccess(ctx.ctx)
    definition = await skills.get(input.name, { cwd })
  } catch {
    definition = undefined
  }

  const roots = managedSkillRoots(ctx, cwd)
  let targetDir: string
  let targetFile: string | undefined

  if (definition?.path !== undefined) {
    assertManagedSkillPath(definition.path, roots)
    const existingPath = definition.path
    const isBundle = existingPath.endsWith('SKILL.md')
    targetDir = isBundle ? dirname(existingPath) : existingPath
    targetFile = isBundle ? undefined : existingPath
    await rm(targetDir, { recursive: true, force: true })
    if (targetFile !== undefined) await rm(targetFile, { recursive: true, force: true })
  } else {
    targetDir = join(resolveDshSkillsRoot(ctx.dshHome), input.name)
    targetFile = undefined
  }

  if (targetFile !== undefined) {
    await copyFile(chosen.originalPath, targetFile)
  } else {
    await mkdir(dirname(targetDir), { recursive: true })
    await cp(chosen.originalPath, targetDir, { recursive: true, force: true })
  }

  const all = metadata.get().records
  const next = all.map(record =>
    record.name === input.name && record.result === 'conflict'
      ? { ...record, resolved: true, reason: `resolved: chose ${input.source}` }
      : record,
  )
  await metadata.save({
    ...metadata.get(),
    records: next,
  })
}
