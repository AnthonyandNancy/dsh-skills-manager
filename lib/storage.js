/**
 * Lightweight plugin metadata storage (Metadata V2).
 *
 * The plugin stores only import metadata (scan status, source mapping,
 * fingerprints, conflict state). It never stores skill bodies or a second
 * skill model. When DSH's Settings seam is mounted, the metadata lives in a
 * plugin-owned settings namespace; otherwise an in-memory fallback keeps the
 * plugin functional for the current process.
 *
 * V2 separates two concerns that V1 conflated:
 * - `lastScan` is the single most recent scan, replaced whole every scan, so
 *   duplicate/invalid records can never accumulate across scans.
 * - `importedProvenance` is history only. It records that this plugin once
 *   imported a skill, and must never be used to decide whether DSH has it now.
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import z from '@deepseek-ai/schemastery';
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths';
export const SKILLS_MANAGER_NS = 'skills-manager';
export const importMetadataRecordSchema = z.object({
    source: z.string(),
    originalPath: z.string(),
    canonicalPath: z.string(),
    fingerprint: z.string(),
    name: z.string(),
    result: z.string(),
    importedSkillId: z.string().default(''),
    reason: z.string(),
    resolved: z.boolean().default(false),
    duplicateReason: z.string().default(''),
    groupKey: z.string().default(''),
    importStatus: z.string().default(''),
});
export const skillsManagerMetadataSchema = z.object({
    version: z.number().default(2),
    externalImportCompleted: z.boolean(),
    // The scan snapshot is an opaque blob to the settings schema: it is written
    // and read only by this plugin, and validating its full shape here would
    // duplicate the ImportReport type without adding safety.
    lastScan: z.any(),
    importedProvenance: z.array(z.any()).default([]),
});
const EMPTY_METADATA = {
    version: 2,
    externalImportCompleted: false,
};
function isObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isRecord(value) {
    if (!isObject(value))
        return false;
    return typeof value.source === 'string'
        && typeof value.originalPath === 'string'
        && typeof value.canonicalPath === 'string'
        && typeof value.fingerprint === 'string'
        && typeof value.name === 'string'
        && typeof value.result === 'string'
        && typeof value.reason === 'string';
}
function isProvenance(value) {
    if (!isObject(value))
        return false;
    return typeof value.skillName === 'string'
        && typeof value.originalFingerprint === 'string'
        && typeof value.firstImportedAt === 'string'
        && Array.isArray(value.sources);
}
/** Accept a persisted `lastScan` only when it carries a usable report. */
function normalizeLastScan(value) {
    if (!isObject(value))
        return undefined;
    const report = value.report;
    if (!isObject(report) || typeof report.scannedCandidates !== 'number')
        return undefined;
    if (typeof value.startedAt !== 'string' || typeof value.finishedAt !== 'string')
        return undefined;
    return {
        scanId: typeof value.scanId === 'string' ? value.scanId : value.finishedAt,
        startedAt: value.startedAt,
        finishedAt: value.finishedAt,
        report: report,
        records: Array.isArray(value.records) ? value.records.filter(isRecord) : [],
    };
}
/**
 * Read persisted metadata, migrating V1 shapes forward.
 *
 * V1 stored a mixed `records` array that had already dropped `new` records, so
 * historical import totals cannot be recovered from it. Migration therefore
 * keeps only `externalImportCompleted` plus the legacy records as inert
 * informational data; accurate numbers come from the next scan.
 */
export function normalizeMetadata(value) {
    if (!isObject(value))
        return EMPTY_METADATA;
    const externalImportCompleted = value.externalImportCompleted === true;
    const lastScan = normalizeLastScan(value.lastScan);
    const provenance = Array.isArray(value.importedProvenance)
        ? value.importedProvenance.filter(isProvenance)
        : [];
    // V1 metadata has `records` at the top level and no usable `lastScan`.
    const legacyRecords = Array.isArray(value.records) ? value.records.filter(isRecord) : [];
    return {
        version: 2,
        externalImportCompleted,
        ...lastScan === undefined ? {} : { lastScan },
        ...provenance.length === 0 ? {} : { importedProvenance: provenance },
        ...legacyRecords.length === 0 ? {} : { legacyRecords },
        ...typeof value.lastScanAt === 'string' && value.lastScanAt.length > 0
            ? { lastScanAt: value.lastScanAt }
            : {},
    };
}
/** An in-memory metadata store, used as a fallback and by tests. */
export function createMemoryMetadataStore(initial) {
    let state = initial === undefined ? EMPTY_METADATA : normalizeMetadata(initial);
    return {
        async ready() {
            // Nothing to load: the state is already in memory.
        },
        get() {
            return state;
        },
        async save(metadata) {
            state = metadata;
        },
    };
}
/** Absolute path of the metadata file this plugin owns below the DSH home. */
export function metadataFilePath(dshHome) {
    return join(resolveDshHome(dshHome), 'skills-manager', 'metadata.json');
}
/**
 * File-backed metadata store.
 *
 * The plugin's own file is the store for every release whose settings seam is
 * not a plugin-data seam (see {@link createMetadataStore}). A read that beats
 * the initial load sees empty metadata, so callers await
 * {@link MetadataStore.ready} first; `save()` waits for that same load, so a
 * scan can never overwrite history it has not read yet.
 * @param path - absolute path of the metadata file.
 * @returns the store; writers are serialized and land through a temp-file rename.
 */
export function createFileMetadataStore(path) {
    let state;
    let queue = Promise.resolve();
    const loaded = (async () => {
        try {
            state = normalizeMetadata(JSON.parse(await readFile(path, 'utf8')));
        }
        catch {
            // Missing (first run) or unreadable/corrupt: stay empty and let the next
            // save rewrite the file rather than failing the management surface.
            state = undefined;
        }
    })();
    const write = async (metadata) => {
        await mkdir(dirname(path), { recursive: true });
        const temp = `${path}.${process.pid}.tmp`;
        await writeFile(temp, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
        await rename(temp, path);
    };
    return {
        async ready() {
            await loaded;
        },
        get() {
            return state ?? EMPTY_METADATA;
        },
        async save(metadata) {
            await loaded;
            state = metadata;
            queue = queue.then(() => write(metadata), () => write(metadata));
            await queue;
        },
    };
}
/**
 * Build the metadata store bound to the plugin context.
 *
 * The settings seam is capability-probed, never assumed. DSH ≤0.1.6 exposes
 * `ctx.settings.register(ns, schema, …)`, a plugin-owned namespace the host
 * persists for us — the best home whenever it exists. 0.1.7 replaced that with
 * `SettingsForms`, a projection of composed profile entries
 * (`configure`/`describe`/`update`) with no namespace registration at all, so
 * probing for `register` keeps the old path and falls back to the plugin's own
 * file instead of throwing against a seam that no longer means what it did.
 * @param ctx - plugin context used for the optional settings injection.
 * @param options - DSH home the fallback file lives under.
 * @returns the store the API reads and writes import metadata through.
 */
export function createMetadataStore(ctx, options = {}) {
    const file = createFileMetadataStore(metadataFilePath(options.dshHome));
    let namespace;
    ctx.inject(['settings'], (sctx) => {
        if (typeof sctx.settings?.register !== 'function')
            return;
        namespace = sctx.settings.register(SKILLS_MANAGER_NS, skillsManagerMetadataSchema, {
            applies: 'live',
            base: EMPTY_METADATA,
        });
    });
    return {
        async ready() {
            await file.ready();
        },
        get() {
            if (namespace !== undefined) {
                try {
                    return normalizeMetadata(namespace.get());
                }
                catch {
                    // A host namespace that cannot answer is not a reason to lose the
                    // report: serve the file below instead.
                }
            }
            return file.get();
        },
        async save(metadata) {
            if (namespace !== undefined) {
                try {
                    await namespace.replace(metadata);
                    return;
                }
                catch {
                    // Fall through to the file, so a namespace the host refuses still
                    // leaves the caller with a persisted record.
                }
            }
            await file.save(metadata);
        },
    };
}
//# sourceMappingURL=storage.js.map