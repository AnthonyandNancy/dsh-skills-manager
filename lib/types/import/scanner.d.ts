/**
 * External skill discovery: walks configured source roots and produces
 * normalized candidates. This module owns no skill runtime state; it only
 * finds SKILL.md files, reads their frontmatter, and fingerprints them.
 */
import type { ExternalSkillCandidate, ExternalSkillSource, ImportReportItem } from '../types.ts';
export interface DiscoveryResult {
    readonly candidates: ExternalSkillCandidate[];
    readonly invalid: ImportReportItem[];
}
/** Read a skill entry's SKILL.md path and validate its frontmatter. */
export declare function discoverExternalSkills(sources: readonly ExternalSkillSource[], cwd?: string): Promise<DiscoveryResult>;
