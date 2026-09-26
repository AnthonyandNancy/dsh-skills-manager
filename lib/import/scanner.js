/**
 * External skill discovery: walks configured source roots and produces
 * normalized candidates. This module owns no skill runtime state; it only
 * finds SKILL.md files, reads their frontmatter, and fingerprints them.
 */
import { readdir, readFile, realpath } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { parseSkillFrontmatter } from "./parser.js";
import { fingerprintSkillPath } from "./fingerprint.js";
/** Kebab-case skill name grammar, matching DSH's native Skill name rule. */
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function isSkillName(name) {
    return SKILL_NAME.test(name);
}
/** Read a skill entry's SKILL.md path and validate its frontmatter. */
export async function discoverExternalSkills(sources, cwd) {
    const candidates = [];
    const invalid = [];
    const seenRoots = new Set();
    for (const source of sources) {
        for (const root of source.getSkillRoots(cwd)) {
            let canonicalRoot;
            try {
                canonicalRoot = await realpath(root);
            }
            catch {
                // Missing roots are normal (the agent may not be installed).
                continue;
            }
            if (seenRoots.has(canonicalRoot))
                continue;
            seenRoots.add(canonicalRoot);
            let entries;
            try {
                entries = await readdir(root, { withFileTypes: true });
            }
            catch (error) {
                invalid.push({
                    source: source.id,
                    skill: basename(root),
                    path: root,
                    result: 'invalid',
                    reason: `cannot read skill root: ${errorMessage(error)}`,
                });
                continue;
            }
            for (const entry of entries) {
                if (entry.name === '.system')
                    continue;
                const full = join(root, entry.name);
                const skillMdPath = entry.isDirectory()
                    ? join(full, 'SKILL.md')
                    : entry.isFile() && entry.name.endsWith('.md')
                        ? full
                        : undefined;
                if (skillMdPath === undefined)
                    continue;
                let raw;
                try {
                    raw = await readFile(skillMdPath, 'utf8');
                }
                catch (error) {
                    invalid.push({
                        source: source.id,
                        skill: entry.name,
                        path: full,
                        result: 'invalid',
                        reason: `cannot read SKILL.md: ${errorMessage(error)}`,
                    });
                    continue;
                }
                const parsed = parseSkillFrontmatter(raw);
                if (parsed === undefined || parsed.name === undefined || parsed.description === undefined) {
                    invalid.push({
                        source: source.id,
                        skill: entry.name,
                        path: full,
                        result: 'invalid',
                        reason: 'missing YAML frontmatter or required name/description',
                    });
                    continue;
                }
                if (!isSkillName(parsed.name)) {
                    invalid.push({
                        source: source.id,
                        skill: entry.name,
                        path: full,
                        result: 'invalid',
                        reason: `invalid kebab-case skill name "${parsed.name}"`,
                    });
                    continue;
                }
                let canonicalPath;
                try {
                    canonicalPath = await realpath(full);
                }
                catch (error) {
                    invalid.push({
                        source: source.id,
                        skill: entry.name,
                        path: full,
                        result: 'invalid',
                        reason: `cannot canonicalize path: ${errorMessage(error)}`,
                    });
                    continue;
                }
                let fingerprint;
                try {
                    fingerprint = await fingerprintSkillPath(full);
                }
                catch (error) {
                    invalid.push({
                        source: source.id,
                        skill: entry.name,
                        path: full,
                        result: 'invalid',
                        reason: `cannot fingerprint skill: ${errorMessage(error)}`,
                    });
                    continue;
                }
                candidates.push({
                    source: source.id,
                    rootPath: root,
                    skillPath: full,
                    skillMdPath,
                    canonicalPath,
                    name: parsed.name,
                    description: parsed.description,
                    ...parsed.whenToUse !== undefined ? { whenToUse: parsed.whenToUse } : {},
                    fingerprint,
                });
            }
        }
    }
    return { candidates, invalid };
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
//# sourceMappingURL=scanner.js.map