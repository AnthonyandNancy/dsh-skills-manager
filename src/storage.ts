/**
 * Lightweight plugin metadata storage (Metadata V2).
 *
 * The plugin stores only import metadata (scan status, source mapping,
 * fingerprints, conflict state). It never stores skill bodies or a second
 * skill model. When DSH's Settings seam is mounted, the metadata lives in a
 * plugin-owned settings namespace; otherwise an in-memory fallback keeps the
 * plugin functional for the current process.
 *
 * V2 separates two concerns that V1 conflated:
 * - `lastScan` is the single most recent scan, replaced whole every scan, so
 *   duplicate/invalid records can never accumulate across scans.
 * - `importedProvenance` is history only. It records that this plugin once
 *   imported a skill, and must never be used to decide whether DSH has it now.
 */

import z from '@deepseek-ai/schemastery'
import type {
  ImportMetadataRecord,
  ImportedSkillProvenance,
  SkillsManagerLastScan,
  SkillsManagerMetadata,
} from './types.ts'

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
  duplicateReason: z.string().default(''),
  groupKey: z.string().default(''),
  importStatus: z.string().default(''),
})

export const skillsManagerMetadataSchema: ReturnType<typeof z.object> = z.object({
  version: z.number().default(2),
  externalImportCompleted: z.boolean(),
  // The scan snapshot is an opaque blob to the settings schema: it is written
  // and read only by this plugin, and validating its full shape here would
  // duplicate the ImportReport type without adding safety.
  lastScan: z.any(),
  importedProvenance: z.array(z.any()).default([]),
})

export interface MetadataStore {
  get(): SkillsManagerMetadata
  save(metadata: SkillsManagerMetadata): Promise<void>
}

const EMPTY_METADATA: SkillsManagerMetadata = {
  version: 2,
  externalImportCompleted: false,
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isRecord(value: unknown): value is ImportMetadataRecord {
  if (!isObject(value)) return false
  return typeof value.source === 'string'
    && typeof value.originalPath === 'string'
    && typeof value.canonicalPath === 'string'
    && typeof value.fingerprint === 'string'
    && typeof value.name === 'string'
    && typeof value.result === 'string'
    && typeof value.reason === 'string'
}

function isProvenance(value: unknown): value is ImportedSkillProvenance {
  if (!isObject(value)) return false
  return typeof value.skillName === 'string'
    && typeof value.originalFingerprint === 'string'
    && typeof value.firstImportedAt === 'string'
    && Array.isArray(value.sources)
}

/** Accept a persisted `lastScan` only when it carries a usable report. */
function normalizeLastScan(value: unknown): SkillsManagerLastScan | undefined {
  if (!isObject(value)) return undefined
  const report = value.report
  if (!isObject(report) || typeof report.scannedCandidates !== 'number') return undefined
  if (typeof value.startedAt !== 'string' || typeof value.finishedAt !== 'string') return undefined
  return {
    scanId: typeof value.scanId === 'string' ? value.scanId : value.finishedAt,
    startedAt: value.startedAt,
    finishedAt: value.finishedAt,
    report: report as unknown as SkillsManagerLastScan['report'],
    records: Array.isArray(value.records) ? value.records.filter(isRecord) : [],
  }
}

/**
 * Read persisted metadata, migrating V1 shapes forward.
 *
 * V1 stored a mixed `records` array that had already dropped `new` records, so
 * historical import totals cannot be recovered from it. Migration therefore
 * keeps only `externalImportCompleted` plus the legacy records as inert
 * informational data; accurate numbers come from the next scan.
 */
export function normalizeMetadata(value: unknown): SkillsManagerMetadata {
  if (!isObject(value)) return EMPTY_METADATA
  const externalImportCompleted = value.externalImportCompleted === true

  const lastScan = normalizeLastScan(value.lastScan)
  const provenance = Array.isArray(value.importedProvenance)
    ? value.importedProvenance.filter(isProvenance)
    : []

  // V1 metadata has `records` at the top level and no usable `lastScan`.
  const legacyRecords = Array.isArray(value.records) ? value.records.filter(isRecord) : []

  return {
    version: 2,
    externalImportCompleted,
    ...lastScan === undefined ? {} : { lastScan },
    ...provenance.length === 0 ? {} : { importedProvenance: provenance },
    ...legacyRecords.length === 0 ? {} : { legacyRecords },
    ...typeof value.lastScanAt === 'string' && value.lastScanAt.length > 0
      ? { lastScanAt: value.lastScanAt }
      : {},
  }
}

/** An in-memory metadata store, used as a fallback and by tests. */
export function createMemoryMetadataStore(initial?: unknown): MetadataStore {
  let state = initial === undefined ? EMPTY_METADATA : normalizeMetadata(initial)
  return {
    get() {
      return state
    },
    async save(metadata) {
      state = metadata
    },
  }
}

/**
 * Build a metadata store bound to the plugin context. If the Settings seam is
 * available, it registers a namespace and persists through DSH's official
 * settings provider; otherwise it falls back to memory.
 */
export function createMetadataStore(ctx: any): MetadataStore {
  const fallback = createMemoryMetadataStore()
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
          return fallback.get()
        }
      }
      return fallback.get()
    },
    async save(metadata) {
      await fallback.save(metadata)
      if (scope !== undefined) {
        await scope.replace(metadata as never)
      }
    },
  }
}
