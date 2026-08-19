/**
 * Lightweight plugin metadata storage.
 *
 * The plugin stores only import metadata (scan status, source mapping,
 * fingerprints, conflict state). It never stores skill bodies or a second
 * skill model. When DSH's Settings seam is mounted, the metadata lives in a
 * plugin-owned settings namespace; otherwise an in-memory fallback keeps the
 * plugin functional for the current process.
 */

import z from '@deepseek-ai/schemastery'
import type { ImportMetadataRecord, SkillsManagerMetadata } from './types.ts'

export const SKILLS_MANAGER_NS = 'skills-manager'

export const importMetadataRecordSchema = z.object({
  source: z.string(),
  originalPath: z.string(),
  canonicalPath: z.string(),
  fingerprint: z.string(),
  name: z.string(),
  result: z.string(),
  importedSkillId: z.string().default(''),
  reason: z.string(),
  resolved: z.boolean().default(false),
})

export const skillsManagerMetadataSchema = z.object({
  externalImportCompleted: z.boolean(),
  lastScanAt: z.string().default(''),
  records: z.array(importMetadataRecordSchema).default([]),
})

export interface MetadataStore {
  get(): SkillsManagerMetadata
  save(metadata: SkillsManagerMetadata): Promise<void>
}

const EMPTY_METADATA: SkillsManagerMetadata = {
  externalImportCompleted: false,
  records: [],
}

function normalizeMetadata(value: unknown): SkillsManagerMetadata {
  if (value === null || typeof value !== 'object') return EMPTY_METADATA
  const record = value as Record<string, unknown>
  return {
    externalImportCompleted: record.externalImportCompleted === true,
    ...typeof record.lastScanAt === 'string' ? { lastScanAt: record.lastScanAt } : {},
    records: Array.isArray(record.records)
      ? (record.records as ImportMetadataRecord[]).filter(isRecord)
      : [],
  }
}

function isRecord(value: unknown): value is ImportMetadataRecord {
  if (value === null || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.source === 'string'
    && typeof record.originalPath === 'string'
    && typeof record.canonicalPath === 'string'
    && typeof record.fingerprint === 'string'
    && typeof record.name === 'string'
    && typeof record.result === 'string'
    && typeof record.reason === 'string'
}

/**
 * Build a metadata store bound to the plugin context. If the Settings seam is
 * available, it registers a namespace and persists through DSH's official
 * settings provider; otherwise it falls back to memory.
 */
export function createMetadataStore(ctx: any): MetadataStore {
  let memory = { ...EMPTY_METADATA }
  let scope: { get(): unknown; replace(value: unknown): Promise<void> | void } | undefined

  ctx.inject(['settings'], (sctx: any) => {
    const ns = SKILLS_MANAGER_NS as never
    scope = sctx.settings.register(ns, skillsManagerMetadataSchema, {
      applies: 'live',
      base: EMPTY_METADATA,
    }) as { get(): unknown; replace(value: unknown): Promise<void> | void }
  })

  return {
    get() {
      if (scope !== undefined) {
        try {
          return normalizeMetadata(scope.get())
        } catch {
          return memory
        }
      }
      return memory
    },
    async save(metadata) {
      memory = metadata
      if (scope !== undefined) {
        await scope.replace(metadata as never)
      }
    },
  }
}
