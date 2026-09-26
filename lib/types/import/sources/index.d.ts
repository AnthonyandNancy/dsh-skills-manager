/**
 * External Agent Skills source adapters.
 *
 * Each adapter is deliberately thin: it only answers "where can SKILL.md files
 * live for this agent". It does not parse, register, load, or manage skills.
 * Roots are derived from the current user's home directory plus (when a cwd is
 * supplied) project-local roots. A root that does not exist is simply not
 * scanned.
 */
import type { ExternalSkillSource, ExternalSourceId } from '../../types.ts';
export declare const claudeSource: ExternalSkillSource;
export declare const codexSource: ExternalSkillSource;
export declare const cursorSource: ExternalSkillSource;
export declare const geminiSource: ExternalSkillSource;
export declare const externalSources: readonly ExternalSkillSource[];
export declare function sourceLabel(id: ExternalSourceId): string;
