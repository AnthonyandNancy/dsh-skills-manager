/**
 * Typed fetch wrapper over the Skills Manager host API.
 *
 * The Host registers one exact Fetch route on DSH's shared `/api` channel; the
 * method selector travels in the JSON body so the transport stays a single
 * fenced, authenticated route instead of a plugin-owned URL space.
 */
/** Absolute path of the Host route, mirrored from `src/routes.ts`. */
export declare const API_PATH = "/api/skills-manager";
export interface ManagedSkillRow {
    name: string;
    description: string;
    whenToUse?: string;
    source: string;
    provider: string;
    path?: string;
    modelInvocable: boolean;
    userInvocable: boolean;
}
export interface ManagedSkillDetail extends ManagedSkillRow {
    content: string;
    resourceBase?: unknown;
}
export interface ImportReportItem {
    source: string;
    skill: string;
    path: string;
    result: 'new' | 'duplicate' | 'conflict' | 'invalid' | 'skipped';
    reason: string;
    fingerprint?: string;
    importedSkillId?: string;
    duplicateReason?: 'same-canonical-path' | 'same-external-fingerprint' | 'already-in-dsh';
    groupKey?: string;
    importStatus?: 'not-needed' | 'imported' | 'failed';
}
export interface DuplicateBreakdown {
    samePath: number;
    sameContent: number;
    alreadyInDsh: number;
}
export interface DuplicateGroup {
    key: string;
    name: string;
    fingerprint?: string;
    inDsh: boolean;
    sources: {
        source: string;
        path: string;
    }[];
    candidateCount: number;
    filteredCopies: number;
    importedThisScan: boolean;
}
/**
 * Import metrics. Candidate-copy metrics (`scannedCandidates`,
 * `duplicateCopies`, `invalid`) and unique-skill metrics (`uniqueValidSkills`,
 * `inDsh`, `importedThisScan`, `conflicts`) are different units and are not
 * expected to sum to `scannedCandidates`.
 */
export interface ImportReport {
    scannedCandidates: number;
    uniqueValidSkills: number;
    inDsh: number;
    importedThisScan: number;
    duplicateCopies: number;
    conflicts: number;
    invalid: number;
    failed: number;
    duplicateBreakdown: DuplicateBreakdown;
    duplicateGroups: DuplicateGroup[];
    items: ImportReportItem[];
    startedAt: string;
    finishedAt: string;
}
export interface DshDuplicateAudit {
    scannedSkills: number;
    duplicateContentGroups: {
        fingerprint: string;
        skills: {
            name: string;
            path?: string;
            source: string;
            provider: string;
        }[];
    }[];
    duplicateNameGroups: {
        name: string;
        skills: {
            name: string;
            path?: string;
            source: string;
            provider: string;
            fingerprint?: string;
        }[];
    }[];
    checkedAt: string;
}
export interface ConflictCandidate {
    source: string;
    label: string;
    path: string;
    fingerprint: string;
    name: string;
    description: string;
}
export interface ConflictView {
    name: string;
    existing?: ManagedSkillRow;
    candidates: ConflictCandidate[];
    reason: string;
}
export declare class SkillsApiError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export interface SkillsManagerApi {
    /** Ask the Host for the fixed DSH-native skills directory; no path input. */
    skillsDirectory(): Promise<{
        directory: string;
    }>;
    listSkills(cwd?: string): Promise<{
        skills: ManagedSkillRow[];
    }>;
    getSkill(name: string, cwd?: string): Promise<{
        skill: ManagedSkillDetail;
    }>;
    createSkill(input: {
        name: string;
        description: string;
        whenToUse?: string;
        body: string;
        scope?: 'global' | 'project';
        cwd?: string;
    }): Promise<{
        skill: ManagedSkillDetail;
    }>;
    updateSkill(input: {
        name: string;
        description: string;
        whenToUse?: string;
        body: string;
        cwd?: string;
    }): Promise<{
        skill: ManagedSkillDetail;
    }>;
    deleteSkill(name: string, cwd?: string): Promise<{
        deleted: string;
    }>;
    scanExternal(cwd?: string): Promise<{
        report: ImportReport;
    }>;
    importMeta(): Promise<{
        externalImportCompleted: boolean;
        lastScanAt?: string;
        report?: ImportReport;
    }>;
    listConflicts(cwd?: string): Promise<{
        conflicts: ConflictView[];
    }>;
    resolveConflict(name: string, source: string, cwd?: string): Promise<{
        resolved: string;
    }>;
    /** On-demand diagnostics; re-fingerprints native skills, so never automatic. */
    auditDuplicates(cwd?: string): Promise<{
        audit: DshDuplicateAudit;
    }>;
}
export declare const skillsManagerApi: SkillsManagerApi;
//# sourceMappingURL=api.d.ts.map