/**
 * Deterministic content fingerprint for external/DSH skill directories.
 *
 * The fingerprint is intentionally not based on directory names or filesystem
 * metadata. It hashes normalized relative paths plus file contents, sorted so
 * traversal order never matters. Symlinks are not followed: a symlink is a
 * filesystem indirection, and following it could escape the skill directory or
 * create loops. Broken/permission-denied files are recorded as errors by the
 * scanner and do not fail the whole scan.
 */
/** Resolve a path to its canonical real path. */
export declare function canonicalRealPath(path: string): Promise<string>;
/** Hash a single string into a stable hex digest. */
export declare function hashText(value: string): string;
/**
 * Compute a fingerprint for a skill entry.
 *
 * `skillPath` is either a directory bundle (contains SKILL.md) or a flat
 * Markdown file. When it is a directory, every regular file below it is
 * included; when it is a file, only that file is included.
 */
export declare function fingerprintSkillPath(skillPath: string): Promise<string>;
/** Infer whether a skill path is a directory bundle or flat file. */
export declare function isDirectoryBundle(skillPath: string): boolean;
/** Canonical identity used for first-layer dedup (realpath). */
export declare function canonicalSkillIdentity(skillPath: string): Promise<{
    canonicalPath: string;
    isDirectory: boolean;
}>;
