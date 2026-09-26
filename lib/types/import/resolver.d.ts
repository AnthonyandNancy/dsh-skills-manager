/**
 * Conflict resolution for external import conflicts.
 *
 * The importer never overwrites automatically. This module lets a user
 * explicitly choose one source version; DSH existing skills are replaced only
 * when the user chooses an external version and the existing skill lives in a
 * writable DSH-managed root. External source files are never modified or
 * deleted.
 */
import type { ConflictView, ExternalSourceId } from '../types.ts';
import type { MetadataStore } from '../storage.ts';
import { type ManagedSkillContext } from '../skills-service.ts';
export interface ResolveConflictInput {
    readonly name: string;
    readonly source: ExternalSourceId;
}
/** Group stored conflict records into UI-ready conflict views. */
export declare function listConflicts(metadata: MetadataStore, existingSkills: {
    name: string;
    path?: string;
}[]): ConflictView[];
/**
 * Resolve one conflict by copying the chosen external version into DSH.
 * When a DSH skill with the same name already exists, it is replaced only at
 * its existing managed location; otherwise the chosen version is imported into
 * the user/global managed root.
 */
export declare function resolveConflict(ctx: ManagedSkillContext, metadata: MetadataStore, input: ResolveConflictInput, cwd?: string): Promise<void>;
