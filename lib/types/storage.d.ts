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
import z from '@deepseek-ai/schemastery';
import type { SkillsManagerMetadata } from './types.ts';
export declare const SKILLS_MANAGER_NS = "skills-manager";
export declare const importMetadataRecordSchema: z<Schemastery.ObjectS<NoInfer<{
    source: z<string, string, "plain">;
    originalPath: z<string, string, "plain">;
    canonicalPath: z<string, string, "plain">;
    fingerprint: z<string, string, "plain">;
    name: z<string, string, "plain">;
    result: z<string, string, "plain">;
    importedSkillId: z<string, string, "defined">;
    reason: z<string, string, "plain">;
    resolved: z<boolean, boolean, "defined">;
    duplicateReason: z<string, string, "defined">;
    groupKey: z<string, string, "defined">;
    importStatus: z<string, string, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    source: z<string, string, "plain">;
    originalPath: z<string, string, "plain">;
    canonicalPath: z<string, string, "plain">;
    fingerprint: z<string, string, "plain">;
    name: z<string, string, "plain">;
    result: z<string, string, "plain">;
    importedSkillId: z<string, string, "defined">;
    reason: z<string, string, "plain">;
    resolved: z<boolean, boolean, "defined">;
    duplicateReason: z<string, string, "defined">;
    groupKey: z<string, string, "defined">;
    importStatus: z<string, string, "defined">;
}>>, "plain">;
export declare const skillsManagerMetadataSchema: ReturnType<typeof z.object>;
export interface MetadataStore {
    /** Settle the initial load; stores that already hold state resolve immediately. */
    ready(): Promise<void>;
    get(): SkillsManagerMetadata;
    save(metadata: SkillsManagerMetadata): Promise<void>;
}
/**
 * Read persisted metadata, migrating V1 shapes forward.
 *
 * V1 stored a mixed `records` array that had already dropped `new` records, so
 * historical import totals cannot be recovered from it. Migration therefore
 * keeps only `externalImportCompleted` plus the legacy records as inert
 * informational data; accurate numbers come from the next scan.
 */
export declare function normalizeMetadata(value: unknown): SkillsManagerMetadata;
/** An in-memory metadata store, used as a fallback and by tests. */
export declare function createMemoryMetadataStore(initial?: unknown): MetadataStore;
/** Absolute path of the metadata file this plugin owns below the DSH home. */
export declare function metadataFilePath(dshHome?: string): string;
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
export declare function createFileMetadataStore(path: string): MetadataStore;
export interface MetadataStoreOptions {
    /** DSH home override; defaults to `$DSH_HOME` or `~/.dsh`. */
    readonly dshHome?: string;
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
export declare function createMetadataStore(ctx: any, options?: MetadataStoreOptions): MetadataStore;
