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
import { cp, copyFile, mkdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths';
import { createSkillAccess } from "../skills-access.js";
import { discoverExternalSkills } from "./scanner.js";
import { buildDuplicateGroups, deduplicateCandidates } from "./deduplicator.js";
import { fingerprintSkillPath } from "./fingerprint.js";
import { externalSources } from "./sources/index.js";
export function resolveDshSkillsRoot(dshHome) {
    return join(resolveDshHome(dshHome), 'skills');
}
export async function ensureDshSkillsRoot(dshHome) {
    const directory = resolveDshSkillsRoot(dshHome);
    await mkdir(directory, { recursive: true });
    return directory;
}
/** Compute DSH existing skill snapshots for dedup. */
export async function existingSkillSnapshots(ctx, cwd) {
    let skills;
    try {
        skills = await createSkillAccess(ctx);
    }
    catch (error) {
        ctx.logger?.warn?.('[dsh-skills-manager] DSH skills service unavailable; skipping existing-skill dedup: %s', String(error));
        return [];
    }
    let summaries;
    try {
        summaries = await skills.list({ cwd });
    }
    catch (error) {
        ctx.logger?.warn?.('[dsh-skills-manager] failed to list DSH skills for dedup: %s', String(error));
        return [];
    }
    const out = [];
    for (const summary of summaries) {
        let path;
        try {
            const definition = await skills.get(summary.name, { cwd });
            path = definition?.path;
        }
        catch {
            path = undefined;
        }
        let fingerprint;
        if (path !== undefined) {
            try {
                const skillPath = path.endsWith('SKILL.md') ? dirname(path) : path;
                fingerprint = await fingerprintSkillPath(skillPath);
            }
            catch {
                fingerprint = undefined;
            }
        }
        out.push({
            name: summary.name,
            ...path === undefined ? {} : { path },
            ...fingerprint === undefined ? {} : { fingerprint },
            source: summary.source,
            provider: summary.provider,
        });
    }
    return out;
}
/** Thrown when the DSH managed target already exists and must not be overwritten. */
export class SkillTargetExistsError extends Error {
    target;
    conflict;
    constructor(target, conflict, message) {
        super(message);
        this.target = target;
        this.conflict = conflict;
        this.name = 'SkillTargetExistsError';
    }
}
/** Copy one external candidate into DSH's managed user skills root. */
export async function importCandidate(candidate, dshSkillsRoot) {
    await mkdir(dshSkillsRoot, { recursive: true });
    const info = await stat(candidate.skillPath);
    const isDirectory = info.isDirectory();
    const target = isDirectory
        ? join(dshSkillsRoot, candidate.name)
        : join(dshSkillsRoot, `${candidate.name}.md`);
    // Never overwrite an existing DSH skill, even when the live registry cache
    // has not yet observed the managed directory. Compare fingerprints so an
    // identical re-import is a no-op and a different body is a conflict.
    let targetInfo;
    try {
        targetInfo = await stat(target);
    }
    catch {
        targetInfo = undefined;
    }
    if (targetInfo !== undefined) {
        const existingFingerprint = await fingerprintSkillPath(target);
        if (existingFingerprint === candidate.fingerprint) {
            throw new SkillTargetExistsError(target, false, `target already exists and is identical: ${target}`);
        }
        throw new SkillTargetExistsError(target, true, `target already exists with different content: ${target}`);
    }
    if (isDirectory) {
        await cp(candidate.skillPath, target, { recursive: true, errorOnExist: false, force: false });
    }
    else {
        await copyFile(candidate.skillPath, target);
    }
    return target;
}
/**
 * Run the complete external import pipeline. It is idempotent: DSH existing
 * skills are compared by fingerprint/name, so re-running never duplicates.
 *
 * Statistics are computed in two distinct units. Candidate copies drive
 * `scannedCandidates`, `duplicateCopies` and `invalid`; unique logical skills
 * drive `uniqueValidSkills`, `inDsh`, `importedThisScan` and `conflicts`.
 */
export async function runExternalImport(services, cwd) {
    const { ctx, metadata } = services;
    const startedAt = new Date().toISOString();
    const discovered = await discoverExternalSkills(services.sources ?? externalSources, cwd);
    const existing = await existingSkillSnapshots(ctx, cwd);
    const dedup = deduplicateCandidates(discovered.candidates, existing);
    const dshSkillsRoot = resolveDshSkillsRoot(services.dshHome);
    const items = [...dedup.items];
    // Unique skills newly written into DSH by this scan. Counted only after a
    // successful write, so a failed copy never inflates the numbers.
    let importedThisScan = 0;
    // Unique skills that turned out to already exist in DSH at write time, even
    // though the live registry snapshot had not observed them yet.
    let lateAlreadyInDsh = 0;
    let lateConflicts = 0;
    let failed = 0;
    for (const candidate of dedup.toImport) {
        const index = items.findIndex(item => item.path === candidate.skillPath && item.result === 'new');
        const original = index >= 0 ? items[index] : undefined;
        try {
            const target = await importCandidate(candidate, dshSkillsRoot);
            importedThisScan += 1;
            if (original !== undefined) {
                items[index] = {
                    ...original,
                    reason: `imported to ${target}`,
                    importedSkillId: candidate.name,
                    importStatus: 'imported',
                };
            }
        }
        catch (error) {
            if (error instanceof SkillTargetExistsError) {
                if (error.conflict) {
                    lateConflicts += 1;
                }
                else {
                    lateAlreadyInDsh += 1;
                }
                if (original !== undefined) {
                    items[index] = {
                        ...original,
                        result: error.conflict ? 'conflict' : 'duplicate',
                        reason: error.conflict
                            ? `target already exists in DSH skills with different content; not overwritten: ${error.target}`
                            : `already present in DSH skills (identical fingerprint): ${error.target}`,
                        ...error.conflict ? {} : { duplicateReason: 'already-in-dsh' },
                        importStatus: 'not-needed',
                    };
                }
            }
            else {
                failed += 1;
                if (original !== undefined) {
                    items[index] = {
                        ...original,
                        result: 'skipped',
                        reason: `import failed: ${error instanceof Error ? error.message : String(error)}`,
                        importStatus: 'failed',
                    };
                }
            }
        }
    }
    const allItems = [...discovered.invalid, ...items];
    const duplicateCopies = allItems.filter(item => item.result === 'duplicate').length;
    const duplicateBreakdown = {
        samePath: allItems.filter(item => item.duplicateReason === 'same-canonical-path').length,
        sameContent: allItems.filter(item => item.duplicateReason === 'same-external-fingerprint').length,
        alreadyInDsh: allItems.filter(item => item.duplicateReason === 'already-in-dsh').length,
    };
    const report = {
        scannedCandidates: allItems.length,
        uniqueValidSkills: dedup.uniqueValidSkills,
        // Unique external skills DSH exactly represents now: those that already
        // existed plus those this scan successfully wrote.
        inDsh: dedup.alreadyInDsh + lateAlreadyInDsh + importedThisScan,
        importedThisScan,
        duplicateCopies,
        conflicts: dedup.conflictGroups + lateConflicts,
        invalid: allItems.filter(item => item.result === 'invalid').length,
        failed,
        duplicateBreakdown,
        duplicateGroups: buildDuplicateGroups(allItems),
        items: allItems,
        startedAt,
        finishedAt: new Date().toISOString(),
    };
    // Persist lightweight import metadata only. `lastScan` is replaced whole, so
    // stale duplicate/invalid records from earlier scans never accumulate.
    const records = allItems.map(item => ({
        source: item.source,
        originalPath: item.path,
        canonicalPath: item.path,
        fingerprint: item.fingerprint ?? '',
        name: item.skill,
        result: item.result,
        ...item.importedSkillId === undefined ? {} : { importedSkillId: item.importedSkillId },
        reason: item.reason,
        ...item.duplicateReason === undefined ? {} : { duplicateReason: item.duplicateReason },
        ...item.groupKey === undefined ? {} : { groupKey: item.groupKey },
        ...item.importStatus === undefined ? {} : { importStatus: item.importStatus },
    }));
    const lastScan = {
        scanId: `${report.finishedAt}-${report.scannedCandidates}`,
        startedAt,
        finishedAt: report.finishedAt,
        report,
        records,
    };
    const previous = metadata.get();
    await metadata.save({
        version: 2,
        externalImportCompleted: true,
        lastScan,
        importedProvenance: mergeProvenance(previous.importedProvenance ?? [], allItems, report.finishedAt),
    });
    // Best-effort notification: DSH's filesystem watcher is the primary signal,
    // but an explicit event helps consumers that are not watching this root.
    try {
        ctx.emit?.('skills/change');
    }
    catch {
        // The event is an optional hint; watchers are authoritative.
    }
    return report;
}
/**
 * Merge provenance history for skills this plugin imported.
 *
 * Provenance answers "did this plugin ever import this skill", never "does DSH
 * have it now" — a user may have deleted or edited it afterwards.
 */
function mergeProvenance(previous, items, now) {
    const byName = new Map();
    for (const entry of previous)
        byName.set(entry.skillName, entry);
    for (const item of items) {
        if (item.importStatus !== 'imported')
            continue;
        const existing = byName.get(item.skill);
        const sources = existing === undefined
            ? [item.source]
            : [...new Set([...existing.sources, item.source])];
        byName.set(item.skill, {
            skillName: item.skill,
            originalFingerprint: item.fingerprint ?? existing?.originalFingerprint ?? '',
            firstImportedAt: existing?.firstImportedAt ?? now,
            lastSeenAt: now,
            sources,
        });
    }
    return [...byName.values()];
}
/**
 * Read the most recent scan's persisted report for UI display without
 * rescanning. The report is stored verbatim, so the numbers are never
 * recomputed from a mix of historical records.
 */
export function reportFromMetadata(metadata) {
    return metadata.get().lastScan?.report;
}
/**
 * Report-only audit over DSH's native skills, answering whether the importer
 * ever produced duplicate content inside DSH.
 *
 * This is intentionally not called during normal rendering: it re-fingerprints
 * every native skill. Run it from tests or an explicit diagnostics action.
 */
export async function auditDshSkillDuplicates(ctx, cwd) {
    const snapshots = await existingSkillSnapshots(ctx, cwd);
    const byFingerprint = new Map();
    const byName = new Map();
    for (const snapshot of snapshots) {
        if (snapshot.fingerprint !== undefined) {
            const group = byFingerprint.get(snapshot.fingerprint) ?? [];
            group.push(snapshot);
            byFingerprint.set(snapshot.fingerprint, group);
        }
        const nameKey = snapshot.name.trim().toLowerCase();
        const nameGroup = byName.get(nameKey) ?? [];
        nameGroup.push(snapshot);
        byName.set(nameKey, nameGroup);
    }
    const duplicateContentGroups = [];
    for (const [fingerprint, group] of byFingerprint) {
        // Two registry entries backed by the same path are one skill seen twice.
        const distinct = distinctByPath(group);
        if (distinct.length > 1) {
            duplicateContentGroups.push({ fingerprint, skills: distinct.map(describe) });
        }
    }
    const duplicateNameGroups = [];
    for (const [, group] of byName) {
        const distinct = distinctByPath(group);
        if (distinct.length > 1) {
            duplicateNameGroups.push({
                name: distinct[0].name,
                skills: distinct.map(snapshot => ({
                    ...describe(snapshot),
                    ...snapshot.fingerprint === undefined ? {} : { fingerprint: snapshot.fingerprint },
                })),
            });
        }
    }
    return {
        scannedSkills: snapshots.length,
        duplicateContentGroups,
        duplicateNameGroups,
        checkedAt: new Date().toISOString(),
    };
}
function distinctByPath(group) {
    const seen = new Set();
    const out = [];
    for (const snapshot of group) {
        const key = snapshot.path ?? `name:${snapshot.name}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        out.push(snapshot);
    }
    return out;
}
function describe(snapshot) {
    return {
        name: snapshot.name,
        ...snapshot.path === undefined ? {} : { path: snapshot.path },
        source: snapshot.source ?? 'unknown',
        provider: snapshot.provider ?? 'unknown',
    };
}
//# sourceMappingURL=importer.js.map