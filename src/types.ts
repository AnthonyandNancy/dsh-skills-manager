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

/**
 * Classification of one candidate after parsing + dedup.
 *
 * This is deliberately NOT an import outcome: a candidate classified `new` may
 * still fail to be written. Use `ImportStatus` for the write outcome.
 */
export type ImportResultType =
  | 'new'
  | 'duplicate'
  | 'conflict'
  | 'invalid'
  | 'skipped'

/** Structured reason why a candidate copy was filtered as a duplicate. */
export type DuplicateReason =
  | 'same-canonical-path'
  | 'same-external-fingerprint'
  | 'already-in-dsh'

/** Whether a candidate was actually written into DSH during this scan. */
export type ImportStatus = 'not-needed' | 'imported' | 'failed'

/** One item in an import report. */
export interface ImportReportItem {
  readonly source: ExternalSourceId
  readonly skill: string
  readonly path: string
  /** Classification after parsing + dedup (not an import success flag). */
  readonly result: ImportResultType
  readonly reason: string
  readonly fingerprint?: string
  readonly importedSkillId?: string
  readonly duplicateReason?: DuplicateReason
  readonly groupKey?: string
  /** Actual write outcome; only meaningful for `new` candidates. */
  readonly importStatus?: ImportStatus
}

/** Breakdown of why candidate copies were filtered as duplicates. */
export interface DuplicateBreakdown {
  readonly samePath: number
  readonly sameContent: number
  readonly alreadyInDsh: number
}

/** One logical external skill group shown in duplicate details. */
export interface DuplicateGroup {
  readonly key: string
  readonly name: string
  readonly fingerprint?: string
  /** Whether this unique skill is represented in DSH after the scan. */
  readonly inDsh: boolean
  readonly sources: readonly {
    readonly source: ExternalSourceId
    readonly path: string
  }[]
  /** All external candidate copies observed in this logical group. */
  readonly candidateCount: number
  /** Candidate copies filtered by the import pipeline. */
  readonly filteredCopies: number
  /** Whether this scan wrote this skill into DSH. */
  readonly importedThisScan: boolean
}

/**
 * Aggregate import report returned to the UI.
 *
 * The metrics deliberately mix two units and are NOT expected to sum to
 * `scannedCandidates`:
 * - candidate-copy unit: `scannedCandidates`, `duplicateCopies`, `invalid`
 * - unique-logical-skill unit: `uniqueValidSkills`, `inDsh`,
 *   `importedThisScan`, `conflicts`, `failed`
 */
export interface ImportReport {
  /** Raw external candidates discovered this scan (candidate copies). */
  readonly scannedCandidates: number
  /** Unique logical skills left after parsing + external-to-external dedup. */
  readonly uniqueValidSkills: number
  /** Unique external skills represented in DSH once this scan finished. */
  readonly inDsh: number
  /** Unique skills actually written into DSH by this scan. */
  readonly importedThisScan: number
  /** Candidate copies filtered by the pipeline (copies, not skills). */
  readonly duplicateCopies: number
  /** Conflicting unique skills (same name, different content). */
  readonly conflicts: number
  /** Unparseable candidate copies. */
  readonly invalid: number
  /** Unique skills whose import was attempted and failed. */
  readonly failed: number
  readonly duplicateBreakdown: DuplicateBreakdown
  readonly duplicateGroups: readonly DuplicateGroup[]
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
  readonly duplicateReason?: DuplicateReason
  readonly groupKey?: string
  readonly importStatus?: ImportStatus
}

/** One complete scan snapshot persisted as Metadata V2 `lastScan`. */
export interface SkillsManagerLastScan {
  readonly scanId: string
  readonly startedAt: string
  readonly finishedAt: string
  readonly report: ImportReport
  readonly records: readonly ImportMetadataRecord[]
}

/** Lightweight history note: this plugin imported a skill at some point. */
export interface ImportedSkillProvenance {
  readonly skillName: string
  readonly dshPath?: string
  readonly originalFingerprint: string
  readonly firstImportedAt: string
  readonly lastSeenAt?: string
  readonly sources: readonly string[]
}

/** Durable plugin metadata (no skill bodies). */
export interface SkillsManagerMetadata {
  readonly version: 2
  readonly externalImportCompleted: boolean
  /** Most recent complete scan. Always replaced on the next scan. */
  readonly lastScan?: SkillsManagerLastScan
  /** Provenance/history only; never used to decide current DSH state. */
  readonly importedProvenance?: readonly ImportedSkillProvenance[]
  /** Legacy V1 records, kept only as informational migration data. */
  readonly legacyRecords?: readonly ImportMetadataRecord[]
  /** Legacy V1 timestamp, kept for migration display only. */
  readonly lastScanAt?: string
}

/** One group of DSH native skills that share identical content. */
export interface DshDuplicateContentGroup {
  readonly fingerprint: string
  readonly skills: readonly {
    readonly name: string
    readonly path?: string
    readonly source: string
    readonly provider: string
  }[]
}

/** One group of DSH native skills that share a normalized name. */
export interface DshDuplicateNameGroup {
  readonly name: string
  readonly skills: readonly {
    readonly name: string
    readonly path?: string
    readonly source: string
    readonly provider: string
    readonly fingerprint?: string
  }[]
}

/**
 * Report-only diagnostics over DSH's native skills.
 *
 * This audit never deletes anything: identical content can be a deliberate
 * project/global override, so the decision belongs to the user.
 */
export interface DshDuplicateAudit {
  readonly scannedSkills: number
  readonly duplicateContentGroups: readonly DshDuplicateContentGroup[]
  readonly duplicateNameGroups: readonly DshDuplicateNameGroup[]
  readonly checkedAt: string
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
