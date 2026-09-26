/**
 * Conflict resolution for external import conflicts.
 *
 * The importer never overwrites automatically. This module lets a user
 * explicitly choose one source version; DSH existing skills are replaced only
 * when the user chooses an external version and the existing skill lives in a
 * writable DSH-managed root. External source files are never modified or
 * deleted.
 */
import { cp, copyFile, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createSkillAccess } from "../skills-access.js";
import { assertManagedSkillPath, managedSkillRoots } from "../skills-service.js";
import { resolveDshSkillsRoot } from "./importer.js";
import { sourceLabel } from "./sources/index.js";
/**
 * Unresolved conflict records from the most recent scan.
 *
 * Conflicts always come from `lastScan`: a conflict that no longer appears in
 * the latest scan no longer exists.
 */
function conflictRecords(metadata) {
    const records = metadata.get().lastScan?.records ?? [];
    return records.filter(record => record.result === 'conflict' && record.resolved !== true);
}
/** Group stored conflict records into UI-ready conflict views. */
export function listConflicts(metadata, existingSkills) {
    const records = conflictRecords(metadata);
    const byName = new Map();
    for (const record of records) {
        const group = byName.get(record.name) ?? [];
        group.push(record);
        byName.set(record.name, group);
    }
    const views = [];
    for (const [name, group] of byName) {
        const candidates = group.map(record => ({
            source: record.source,
            label: sourceLabel(record.source),
            path: record.originalPath,
            fingerprint: record.fingerprint,
            name: record.name,
            description: '',
        }));
        const existing = existingSkills.find(skill => skill.name === name);
        views.push({
            name,
            ...existing === undefined ? {} : { existing: { name: existing.name, description: '', source: '', provider: '', ...existing.path === undefined ? {} : { path: existing.path }, modelInvocable: true, userInvocable: true } },
            candidates,
            reason: group[0]?.reason ?? 'same-name-different-content',
        });
    }
    return views;
}
/**
 * Resolve one conflict by copying the chosen external version into DSH.
 * When a DSH skill with the same name already exists, it is replaced only at
 * its existing managed location; otherwise the chosen version is imported into
 * the user/global managed root.
 */
export async function resolveConflict(ctx, metadata, input, cwd) {
    const records = conflictRecords(metadata).filter(record => record.name === input.name);
    const chosen = records.find(record => record.source === input.source);
    if (chosen === undefined) {
        throw new Error(`conflict "${input.name}" has no candidate from source "${input.source}"`);
    }
    let definition;
    try {
        const skills = await createSkillAccess(ctx.ctx);
        definition = await skills.get(input.name, { cwd });
    }
    catch {
        definition = undefined;
    }
    const roots = managedSkillRoots(ctx, cwd);
    let targetDir;
    let targetFile;
    if (definition?.path !== undefined) {
        assertManagedSkillPath(definition.path, roots);
        const existingPath = definition.path;
        const isBundle = existingPath.endsWith('SKILL.md');
        targetDir = isBundle ? dirname(existingPath) : existingPath;
        targetFile = isBundle ? undefined : existingPath;
        await rm(targetDir, { recursive: true, force: true });
        if (targetFile !== undefined)
            await rm(targetFile, { recursive: true, force: true });
    }
    else {
        targetDir = join(resolveDshSkillsRoot(ctx.dshHome), input.name);
        targetFile = undefined;
    }
    if (targetFile !== undefined) {
        await copyFile(chosen.originalPath, targetFile);
    }
    else {
        await mkdir(dirname(targetDir), { recursive: true });
        await cp(chosen.originalPath, targetDir, { recursive: true, force: true });
    }
    // Mark the resolution inside the last scan snapshot; the scan report itself
    // is left untouched because it describes what that scan observed.
    const current = metadata.get();
    const lastScan = current.lastScan;
    if (lastScan === undefined)
        return;
    await metadata.save({
        ...current,
        lastScan: {
            ...lastScan,
            records: lastScan.records.map(record => record.name === input.name && record.result === 'conflict'
                ? { ...record, resolved: true, reason: `resolved: chose ${input.source}` }
                : record),
        },
    });
}
//# sourceMappingURL=resolver.js.map