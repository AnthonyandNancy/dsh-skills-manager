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
import type { DuplicateBreakdown, DuplicateGroup, ExternalSkillCandidate, ImportReportItem } from '../types.ts';
export interface ExistingSkillSnapshot {
    readonly name: string;
    readonly path?: string;
    readonly fingerprint?: string;
    readonly source?: string;
    readonly provider?: string;
}
export interface DeduplicateResult {
    readonly items: ImportReportItem[];
    /** Unique candidates that should be considered for import. */
    readonly toImport: ExternalSkillCandidate[];
    /** Unique candidates that are in conflict and must wait for user resolution. */
    readonly conflicts: ExternalSkillCandidate[];
    /** Number of unique logical skills after external-to-external dedup. */
    readonly uniqueValidSkills: number;
    /**
     * Unique logical skills already represented in DSH by exact content before
     * any import ran this scan. Counted per unique skill, never per copy.
     */
    readonly alreadyInDsh: number;
    /** Conflicting unique logical skills, grouped by name. */
    readonly conflictGroups: number;
    /** Candidate-copy-level duplicate reason counts. */
    readonly duplicateBreakdown: DuplicateBreakdown;
}
/**
 * Deduplicate candidates against each other and against DSH's existing skills.
 */
export declare function deduplicateCandidates(candidates: readonly ExternalSkillCandidate[], existing: readonly ExistingSkillSnapshot[]): DeduplicateResult;
/**
 * Build duplicate detail groups from a final report item list.
 *
 * One group is one unique logical skill, so N external copies of the same
 * skill appear as one row with N sources instead of N unrelated rows.
 */
export declare function buildDuplicateGroups(items: readonly ImportReportItem[]): DuplicateGroup[];
