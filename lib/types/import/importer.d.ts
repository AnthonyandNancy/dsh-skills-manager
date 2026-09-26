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
import type { DshDuplicateAudit, ExternalSkillCandidate, ExternalSkillSource, ImportReport } from '../types.ts';
import type { MetadataStore } from '../storage.ts';
import { type ExistingSkillSnapshot } from './deduplicator.ts';
/** Minimal shape of DSH native skill summary used for dedup. */
export interface SkillSummaryLike {
    readonly name: string;
    readonly description: string;
    readonly whenToUse?: string;
    readonly source: string;
    readonly provider: string;
    readonly invocation: {
        readonly modelInvocable: boolean;
        readonly userInvocable: boolean;
    };
}
export interface ImportServices {
    /** DSH context; `skills` and `logger` are accessed structurally. */
    readonly ctx: {
        get?: (name: string) => any;
        skills?: any;
        logger?: {
            info?: (...args: any[]) => void;
            warn?: (...args: any[]) => void;
        };
        emit?: (event: string, ...args: any[]) => void;
    };
    readonly metadata: MetadataStore;
    readonly dshHome?: string;
    /** Overridable external source list; defaults to the real agent roots. */
    readonly sources?: readonly ExternalSkillSource[];
}
export declare function resolveDshSkillsRoot(dshHome?: string): string;
export declare function ensureDshSkillsRoot(dshHome?: string): Promise<string>;
/** Compute DSH existing skill snapshots for dedup. */
export declare function existingSkillSnapshots(ctx: ImportServices['ctx'], cwd?: string): Promise<ExistingSkillSnapshot[]>;
/** Thrown when the DSH managed target already exists and must not be overwritten. */
export declare class SkillTargetExistsError extends Error {
    readonly target: string;
    readonly conflict: boolean;
    constructor(target: string, conflict: boolean, message: string);
}
/** Copy one external candidate into DSH's managed user skills root. */
export declare function importCandidate(candidate: ExternalSkillCandidate, dshSkillsRoot: string): Promise<string>;
/**
 * Run the complete external import pipeline. It is idempotent: DSH existing
 * skills are compared by fingerprint/name, so re-running never duplicates.
 *
 * Statistics are computed in two distinct units. Candidate copies drive
 * `scannedCandidates`, `duplicateCopies` and `invalid`; unique logical skills
 * drive `uniqueValidSkills`, `inDsh`, `importedThisScan` and `conflicts`.
 */
export declare function runExternalImport(services: ImportServices, cwd?: string): Promise<ImportReport>;
/**
 * Read the most recent scan's persisted report for UI display without
 * rescanning. The report is stored verbatim, so the numbers are never
 * recomputed from a mix of historical records.
 */
export declare function reportFromMetadata(metadata: Pick<MetadataStore, 'get'>): ImportReport | undefined;
/**
 * Report-only audit over DSH's native skills, answering whether the importer
 * ever produced duplicate content inside DSH.
 *
 * This is intentionally not called during normal rendering: it re-fingerprints
 * every native skill. Run it from tests or an explicit diagnostics action.
 */
export declare function auditDshSkillDuplicates(ctx: ImportServices['ctx'], cwd?: string): Promise<DshDuplicateAudit>;
