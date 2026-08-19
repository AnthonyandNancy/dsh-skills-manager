/**
 * Shared host-side types for the Skills Manager plugin.
 *
 * These types describe the *management surface* only. They do not replace or
 * duplicate DSH's native Skill model: DSH `ctx.skills` remains the only source
 * of truth for runtime skill data. The plugin's own types are limited to the
 * external-import pipeline, import metadata, and the JSON API wire shape.
 */

/** Stable source ids recognized by the external importer. */
export type ExternalSourceId = 'claude' | 'codex' | 'cursor' | 'gemini'

/** One external skill root adapter. */
export interface ExternalSkillSource {
  readonly id: ExternalSourceId
  readonly label: string
  /** Return candidate root directories for this agent's skill libraries. */
  readonly getSkillRoots: (cwd?: string) => readonly string[]
}

/** A discovered external skill before normalization/import. */
export interface ExternalSkillCandidate {
  readonly source: ExternalSourceId
  readonly rootPath: string
  /** Directory containing SKILL.md, or the flat .md file itself. */
  readonly skillPath: string
  /** Absolute path to SKILL.md (directory bundle) or the flat .md file. */
  readonly skillMdPath: string
  readonly canonicalPath: string
  readonly name: string
  readonly description: string
  readonly whenToUse?: string
  readonly fingerprint: string
}

/** Classification result for one candidate after dedup/conflict detection. */
export type ImportResultType =
  | 'new'
  | 'duplicate'
  | 'conflict'
  | 'invalid'
  | 'skipped'

/** One item in an import report. */
export interface ImportReportItem {
  readonly source: ExternalSourceId
  readonly skill: string
  readonly path: string
  readonly result: ImportResultType
  readonly reason: string
  readonly fingerprint?: string
  readonly importedSkillId?: string
}

/** Aggregate import report returned to the UI. */
export interface ImportReport {
  readonly scanned: number
  readonly imported: number
  readonly duplicates: number
  readonly conflicts: number
  readonly invalid: number
  readonly skipped: number
  readonly items: readonly ImportReportItem[]
  readonly startedAt: string
  readonly finishedAt: string
}

/** Lightweight durable metadata record for one import item. */
export interface ImportMetadataRecord {
  readonly source: ExternalSourceId
  readonly originalPath: string
  readonly canonicalPath: string
  readonly fingerprint: string
  readonly name: string
  readonly result: ImportResultType
  readonly importedSkillId?: string
  readonly reason: string
  readonly resolved?: boolean
}

/** Durable plugin metadata (no skill bodies). */
export interface SkillsManagerMetadata {
  readonly externalImportCompleted: boolean
  readonly lastScanAt?: string
  readonly records: readonly ImportMetadataRecord[]
}

/** A skill row returned by the management API. */
export interface ManagedSkillRow {
  readonly name: string
  readonly description: string
  readonly whenToUse?: string
  readonly source: string
  readonly provider: string
  readonly path?: string
  readonly modelInvocable: boolean
  readonly userInvocable: boolean
}

/** A full skill returned by the management API. */
export interface ManagedSkillDetail extends ManagedSkillRow {
  readonly content: string
  readonly resourceBase?: unknown
}

/** Conflict candidate exposed to the resolution UI. */
export interface ConflictCandidate {
  readonly source: ExternalSourceId
  readonly label: string
  readonly path: string
  readonly fingerprint: string
  readonly name: string
  readonly description: string
}

/** Conflict record exposed to the resolution UI. */
export interface ConflictView {
  readonly name: string
  readonly existing?: ManagedSkillRow
  readonly candidates: readonly ConflictCandidate[]
  readonly reason: string
}
