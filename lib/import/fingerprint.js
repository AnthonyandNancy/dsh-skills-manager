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
import { createHash } from 'node:crypto';
import { readFile, readdir, realpath, stat, lstat } from 'node:fs/promises';
import { basename, join, relative, sep } from 'node:path';
/** Resolve a path to its canonical real path. */
export async function canonicalRealPath(path) {
    return await realpath(path);
}
/** Hash a single string into a stable hex digest. */
export function hashText(value) {
    return createHash('sha256').update(value, 'utf8').digest('hex');
}
/** Normalize a relative path to forward slashes for stable hashing. */
function normalizeRelative(path) {
    return path.split(sep).join('/');
}
/**
 * Compute a fingerprint for a skill entry.
 *
 * `skillPath` is either a directory bundle (contains SKILL.md) or a flat
 * Markdown file. When it is a directory, every regular file below it is
 * included; when it is a file, only that file is included.
 */
export async function fingerprintSkillPath(skillPath) {
    const info = await stat(skillPath);
    const files = info.isDirectory()
        ? await collectFiles(skillPath, skillPath)
        : [skillPath];
    const hash = createHash('sha256');
    for (const file of files.sort()) {
        const content = await readFile(file, 'utf8');
        const rel = normalizeRelative(relative(skillPath, file));
        hash.update(rel);
        hash.update('\0');
        hash.update(content);
        hash.update('\0');
    }
    return hash.digest('hex');
}
/** Recursively collect regular file paths under a root, without following symlinks. */
async function collectFiles(root, current) {
    const entries = await readdir(current, { withFileTypes: true });
    const out = [];
    for (const entry of entries) {
        const full = join(current, entry.name);
        try {
            const linkInfo = await lstat(full);
            if (linkInfo.isSymbolicLink())
                continue;
            const info = await stat(full);
            if (info.isDirectory()) {
                out.push(...await collectFiles(root, full));
            }
            else if (info.isFile()) {
                out.push(full);
            }
        }
        catch {
            // Unreadable entries are skipped; the scanner reports individual errors.
        }
    }
    return out;
}
/** Infer whether a skill path is a directory bundle or flat file. */
export function isDirectoryBundle(skillPath) {
    return basename(skillPath).toLowerCase() === 'skill.md'
        ? false
        : true;
}
/** Canonical identity used for first-layer dedup (realpath). */
export async function canonicalSkillIdentity(skillPath) {
    const info = await stat(skillPath);
    const canonical = await canonicalRealPath(skillPath);
    return { canonicalPath: canonical, isDirectory: info.isDirectory() };
}
//# sourceMappingURL=fingerprint.js.map