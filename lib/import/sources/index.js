/**
 * External Agent Skills source adapters.
 *
 * Each adapter is deliberately thin: it only answers "where can SKILL.md files
 * live for this agent". It does not parse, register, load, or manage skills.
 * Roots are derived from the current user's home directory plus (when a cwd is
 * supplied) project-local roots. A root that does not exist is simply not
 * scanned.
 */
import { homedir } from 'node:os';
import { join } from 'node:path';
const home = homedir();
function projectRoots(cwd, relative) {
    return cwd === undefined || cwd.length === 0 ? [] : [join(cwd, relative)];
}
export const claudeSource = {
    id: 'claude',
    label: 'Claude Code',
    getSkillRoots(cwd) {
        return [
            join(home, '.claude', 'skills'),
            ...projectRoots(cwd, '.claude/skills'),
        ];
    },
};
export const codexSource = {
    id: 'codex',
    label: 'OpenAI Codex',
    getSkillRoots(cwd) {
        return [
            join(home, '.codex', 'skills'),
            ...projectRoots(cwd, '.codex/skills'),
        ];
    },
};
export const cursorSource = {
    id: 'cursor',
    label: 'Cursor',
    getSkillRoots(cwd) {
        return [
            join(home, '.cursor', 'skills'),
            join(home, '.cursor', 'skills-cursor'),
            ...projectRoots(cwd, '.cursor/skills'),
            ...projectRoots(cwd, '.cursor/skills-cursor'),
        ];
    },
};
export const geminiSource = {
    id: 'gemini',
    label: 'Gemini CLI',
    getSkillRoots(cwd) {
        return [
            join(home, '.gemini', 'skills'),
            ...projectRoots(cwd, '.gemini/skills'),
        ];
    },
};
export const externalSources = [
    claudeSource,
    codexSource,
    cursorSource,
    geminiSource,
];
export function sourceLabel(id) {
    return externalSources.find(source => source.id === id)?.label ?? id;
}
//# sourceMappingURL=index.js.map