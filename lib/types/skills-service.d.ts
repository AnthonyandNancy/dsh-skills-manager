/**
 * Management service over DSH's native Skills system.
 *
 * This service is deliberately thin: it reads through `ctx.skills` (the native
 * registry) and writes through DSH's managed skills directories. It does not
 * implement a registry, loader, cache, watcher, or runtime.
 */
import type { ManagedSkillDetail, ManagedSkillRow } from './types.ts';
export interface ManagedSkillContext {
    /** DSH context; the skills service is fetched via `ctx.get('skills')`. */
    readonly ctx: {
        get?: (name: string) => any;
        skills?: any;
        logger?: {
            info?: (...args: any[]) => void;
            warn?: (...args: any[]) => void;
            error?: (...args: any[]) => void;
        };
    };
    readonly dshHome?: string;
}
/** Resolve the DSH-managed roots that this plugin is allowed to write/delete. */
export declare function managedSkillRoots(ctx: ManagedSkillContext, cwd?: string): string[];
/** Verify a path is inside one of DSH's managed skill roots. */
export declare function assertManagedSkillPath(path: string, roots: readonly string[]): void;
/** List DSH native skills with management metadata. */
export declare function listManagedSkills(ctx: ManagedSkillContext, cwd?: string): Promise<ManagedSkillRow[]>;
/** Read one DSH native skill including its body. */
export declare function getManagedSkill(ctx: ManagedSkillContext, name: string, cwd?: string): Promise<ManagedSkillDetail>;
/** Create a new DSH skill in the user/global managed root. */
export declare function createManagedSkill(ctx: ManagedSkillContext, input: {
    name: string;
    description: string;
    whenToUse?: string;
    body: string;
}): Promise<ManagedSkillDetail>;
/** Update an existing DSH skill through its managed filesystem location. */
export declare function updateManagedSkill(ctx: ManagedSkillContext, input: {
    name: string;
    description: string;
    whenToUse?: string;
    body: string;
}, cwd?: string): Promise<ManagedSkillDetail>;
/** Delete a DSH-managed skill. External source files are never touched. */
export declare function deleteManagedSkill(ctx: ManagedSkillContext, name: string, cwd?: string): Promise<void>;
/** Read the raw SKILL.md content from a managed skill path. */
export declare function readSkillFile(path: string): Promise<string>;
