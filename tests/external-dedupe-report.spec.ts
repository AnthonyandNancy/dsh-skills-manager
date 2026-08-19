/**
 * Statistics-model tests for the External Skills import report.
 *
 * These tests pin the metric semantics the UI depends on:
 * - `scannedCandidates` counts raw external candidate copies
 * - `uniqueValidSkills` counts unique logical skills after external dedup
 * - `inDsh` counts unique skills currently represented in DSH
 * - `importedThisScan` counts unique skills actually written this scan
 * - `duplicateCopies` counts filtered candidate copies
 */

import { describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, readdir, rm, writeFile, chmod, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { runExternalImport, reportFromMetadata, auditDshSkillDuplicates } from '../src/import/importer.ts'
import { fingerprintSkillPath } from '../src/import/fingerprint.ts'
import { createMemoryMetadataStore, normalizeMetadata, skillsManagerMetadataSchema } from '../src/storage.ts'
import type { ExternalSkillSource } from '../src/types.ts'

async function tempDir(): Promise<string> {
  return await mkdtemp(join(tmpdir(), 'dsh-skills-report-'))
}

function skillBody(name: string, body: string): string {
  return `---\nname: ${name}\ndescription: description of ${name}\n---\n${body}`
}

/** Create one external skill bundle under `<root>/<name>/SKILL.md`. */
async function writeExternalSkill(root: string, name: string, body = 'Body'): Promise<string> {
  const dir = join(root, name)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'SKILL.md'), skillBody(name, body), 'utf8')
  return dir
}

/** Sources whose roots point at the test sandbox instead of the real home. */
function sandboxSources(dir: string, ids: readonly ('claude' | 'codex' | 'cursor' | 'gemini')[]): ExternalSkillSource[] {
  return ids.map(id => ({
    id,
    label: id,
    getSkillRoots: () => [join(dir, id, 'skills')],
  }))
}

/**
 * A fake DSH native skill registry backed by the managed skills directory, so
 * a scan observes exactly what a previous scan wrote (as DSH's watcher would).
 */
function dshRegistryCtx(dshHome: string) {
  const root = join(dshHome, 'skills')
  async function entries(): Promise<{ name: string; path: string }[]> {
    let names: string[]
    try {
      names = (await readdir(root, { withFileTypes: true }))
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
    } catch {
      return []
    }
    return names.map(name => ({ name, path: join(root, name, 'SKILL.md') }))
  }
  const registry = {
    async list() {
      return (await entries()).map(entry => ({
        name: entry.name,
        description: `description of ${entry.name}`,
        source: 'user-dsh',
        provider: 'filesystem',
        invocation: { modelInvocable: true, userInvocable: true },
      }))
    },
    async get(name: string) {
      const found = (await entries()).find(entry => entry.name === name)
      return found === undefined ? undefined : { name, path: found.path, content: '', description: '' }
    },
  }
  return {
    get: (service: string) => (service === 'skills' ? registry : undefined),
    skills: registry,
    logger: { info: () => {}, warn: () => {} },
    emit: () => {},
  }
}

interface Harness {
  readonly dir: string
  readonly dshHome: string
  readonly metadata: ReturnType<typeof createMemoryMetadataStore>
  scan(ids: readonly ('claude' | 'codex' | 'cursor' | 'gemini')[]): Promise<Awaited<ReturnType<typeof runExternalImport>>>
  dshSkillNames(): Promise<string[]>
}

async function harness(): Promise<Harness> {
  const dir = await tempDir()
  const dshHome = join(dir, 'dsh')
  const metadata = createMemoryMetadataStore()
  return {
    dir,
    dshHome,
    metadata,
    async scan(ids) {
      return await runExternalImport({
        ctx: dshRegistryCtx(dshHome) as never,
        metadata,
        dshHome,
        sources: sandboxSources(dir, ids),
      })
    },
    async dshSkillNames() {
      try {
        return (await readdir(join(dshHome, 'skills'), { withFileTypes: true }))
          .filter(entry => entry.isDirectory())
          .map(entry => entry.name)
          .sort()
      } catch {
        return []
      }
    },
  }
}

describe('external import report metrics', () => {
  it('Test 41: first import of one external skill', async () => {
    const h = await harness()
    try {
      await writeExternalSkill(join(h.dir, 'claude', 'skills'), 'foo')
      const report = await h.scan(['claude'])
      expect(report.scannedCandidates).toBe(1)
      expect(report.uniqueValidSkills).toBe(1)
      expect(report.importedThisScan).toBe(1)
      expect(report.inDsh).toBe(1)
      expect(report.duplicateCopies).toBe(0)
      expect(report.conflicts).toBe(0)
      expect(report.invalid).toBe(0)
    } finally {
      await rm(h.dir, { recursive: true, force: true })
    }
  })

  it('Test 42: second scan reports inDsh=1 and importedThisScan=0', async () => {
    const h = await harness()
    try {
      await writeExternalSkill(join(h.dir, 'claude', 'skills'), 'foo')
      await h.scan(['claude'])
      const second = await h.scan(['claude'])
      expect(second.scannedCandidates).toBe(1)
      expect(second.uniqueValidSkills).toBe(1)
      expect(second.importedThisScan).toBe(0)
      // The key regression: "already in DSH" must never read as zero.
      expect(second.inDsh).toBe(1)
    } finally {
      await rm(h.dir, { recursive: true, force: true })
    }
  })

  it('Test 43: three agents with identical content collapse to one skill', async () => {
    const h = await harness()
    try {
      for (const id of ['claude', 'codex', 'cursor'] as const) {
        await writeExternalSkill(join(h.dir, id, 'skills'), 'foo')
      }
      const report = await h.scan(['claude', 'codex', 'cursor'])
      expect(await h.dshSkillNames()).toEqual(['foo'])
      expect(report.scannedCandidates).toBe(3)
      expect(report.uniqueValidSkills).toBe(1)
      expect(report.importedThisScan).toBe(1)
      expect(report.inDsh).toBe(1)
      expect(report.duplicateCopies).toBe(2)
      expect(report.duplicateBreakdown.sameContent).toBe(2)
    } finally {
      await rm(h.dir, { recursive: true, force: true })
    }
  })

  it('Test 44: three identical agents plus an identical DSH skill', async () => {
    const h = await harness()
    try {
      for (const id of ['claude', 'codex', 'cursor'] as const) {
        await writeExternalSkill(join(h.dir, id, 'skills'), 'foo')
      }
      await writeExternalSkill(join(h.dshHome, 'skills'), 'foo')
      const report = await h.scan(['claude', 'codex', 'cursor'])
      expect(report.importedThisScan).toBe(0)
      expect(report.inDsh).toBe(1)
      expect(report.uniqueValidSkills).toBe(1)
      // Every external copy was filtered: two by content, one by DSH identity.
      expect(report.duplicateCopies).toBe(3)
      expect(report.duplicateBreakdown.alreadyInDsh).toBe(1)
      const group = report.duplicateGroups.find(entry => entry.name === 'foo')
      expect(group?.inDsh).toBe(true)
      expect(group?.candidateCount).toBe(3)
    } finally {
      await rm(h.dir, { recursive: true, force: true })
    }
  })

  it('Test 45: same name with different content is a conflict, not inDsh', async () => {
    const h = await harness()
    try {
      await writeExternalSkill(join(h.dir, 'claude', 'skills'), 'foo', 'External body')
      await writeExternalSkill(join(h.dshHome, 'skills'), 'foo', 'DSH body')
      const report = await h.scan(['claude'])
      expect(report.inDsh).toBe(0)
      expect(report.importedThisScan).toBe(0)
      expect(report.conflicts).toBe(1)
    } finally {
      await rm(h.dir, { recursive: true, force: true })
    }
  })

  it('Test 46: a failed import counts as neither imported nor inDsh', async () => {
    const h = await harness()
    try {
      await writeExternalSkill(join(h.dir, 'claude', 'skills'), 'foo')
      // Make the managed skills root a file so directory creation fails.
      await mkdir(h.dshHome, { recursive: true })
      await writeFile(join(h.dshHome, 'skills'), 'not a directory', 'utf8')
      const report = await h.scan(['claude'])
      expect(report.importedThisScan).toBe(0)
      expect(report.inDsh).toBe(0)
      expect(report.failed).toBe(1)
      expect(report.items.some(item => item.importStatus === 'failed')).toBe(true)
    } finally {
      await rm(h.dir, { recursive: true, force: true })
    }
  })

  it('Test 47: repeated scans are idempotent', async () => {
    const h = await harness()
    try {
      await writeExternalSkill(join(h.dir, 'claude', 'skills'), 'foo')
      await writeExternalSkill(join(h.dir, 'codex', 'skills'), 'bar', 'Other')
      await h.scan(['claude', 'codex'])
      const first = await h.dshSkillNames()
      await h.scan(['claude', 'codex'])
      await h.scan(['claude', 'codex'])
      expect(await h.dshSkillNames()).toEqual(first)
      expect(await h.dshSkillNames()).toEqual(['bar', 'foo'])
    } finally {
      await rm(h.dir, { recursive: true, force: true })
    }
  })

  it('Test 48: metadata never accumulates duplicates across scans', async () => {
    const h = await harness()
    try {
      // Scan A: many identical copies produce many duplicate candidate records.
      for (const id of ['claude', 'codex', 'cursor', 'gemini'] as const) {
        await writeExternalSkill(join(h.dir, id, 'skills'), 'foo')
      }
      const scanA = await h.scan(['claude', 'codex', 'cursor', 'gemini'])
      expect(scanA.duplicateCopies).toBe(3)

      // Scan B: only one source remains visible.
      const scanB = await h.scan(['claude'])
      expect(scanB.duplicateCopies).toBe(1)

      // A reload must show scan B's numbers, never A + B.
      const reloaded = reportFromMetadata(h.metadata)
      expect(reloaded?.duplicateCopies).toBe(1)
      expect(reloaded?.scannedCandidates).toBe(1)
    } finally {
      await rm(h.dir, { recursive: true, force: true })
    }
  })

  it('Test 49: metadata keeps the last scan importedThisScan across reload', async () => {
    const h = await harness()
    try {
      await writeExternalSkill(join(h.dir, 'claude', 'skills'), 'foo')
      await writeExternalSkill(join(h.dir, 'claude', 'skills'), 'bar', 'Other')
      const report = await h.scan(['claude'])
      expect(report.importedThisScan).toBe(2)
      const reloaded = reportFromMetadata(h.metadata)
      expect(reloaded?.importedThisScan).toBe(2)
      expect(reloaded?.inDsh).toBe(2)
    } finally {
      await rm(h.dir, { recursive: true, force: true })
    }
  })

  it('Test 50: legacy V1 metadata migrates without crashing', async () => {
    const h = await harness()
    try {
      const legacy = {
        externalImportCompleted: true,
        lastScanAt: '2026-01-01T00:00:00.000Z',
        records: [
          {
            source: 'claude',
            originalPath: '/old/foo',
            canonicalPath: '/old/foo',
            fingerprint: 'old-fp',
            name: 'foo',
            result: 'duplicate',
            reason: 'legacy record',
          },
        ],
      }
      const store = createMemoryMetadataStore(legacy)
      const migrated = store.get()
      expect(migrated.version).toBe(2)
      expect(migrated.externalImportCompleted).toBe(true)
      expect(migrated.lastScan).toBeUndefined()
      // Legacy counts must never be guessed into the new report.
      expect(reportFromMetadata(store)).toBeUndefined()

      await writeExternalSkill(join(h.dir, 'claude', 'skills'), 'foo')
      const report = await runExternalImport({
        ctx: dshRegistryCtx(h.dshHome) as never,
        metadata: store,
        dshHome: h.dshHome,
        sources: sandboxSources(h.dir, ['claude']),
      })
      expect(report.importedThisScan).toBe(1)
      expect(store.get().lastScan?.report.importedThisScan).toBe(1)
      expect(reportFromMetadata(store)?.scannedCandidates).toBe(1)
    } finally {
      await rm(h.dir, { recursive: true, force: true })
    }
  })

  it('does not touch external source files while deduplicating', async () => {
    const h = await harness()
    try {
      const claude = await writeExternalSkill(join(h.dir, 'claude', 'skills'), 'foo')
      const codex = await writeExternalSkill(join(h.dir, 'codex', 'skills'), 'foo')
      await h.scan(['claude', 'codex'])
      await expect(stat(join(claude, 'SKILL.md'))).resolves.toBeTruthy()
      await expect(stat(join(codex, 'SKILL.md'))).resolves.toBeTruthy()
    } finally {
      await rm(h.dir, { recursive: true, force: true })
    }
  })

  it('counts invalid candidates per candidate, with a reason', async () => {
    const h = await harness()
    try {
      const root = join(h.dir, 'claude', 'skills')
      await writeExternalSkill(root, 'foo')
      const broken = join(root, 'broken')
      await mkdir(broken, { recursive: true })
      await writeFile(join(broken, 'SKILL.md'), 'no frontmatter here', 'utf8')
      const report = await h.scan(['claude'])
      expect(report.scannedCandidates).toBe(2)
      expect(report.invalid).toBe(1)
      expect(report.uniqueValidSkills).toBe(1)
      expect(report.items.find(item => item.result === 'invalid')?.reason).toContain('frontmatter')
    } finally {
      await rm(h.dir, { recursive: true, force: true })
    }
  })
})

describe('metadata V2 persistence', () => {
  it('round-trips a scan through the settings schema without losing metrics', () => {
    // The memory store bypasses schemastery; this covers the real settings path.
    const report = {
      scannedCandidates: 7,
      uniqueValidSkills: 3,
      inDsh: 3,
      importedThisScan: 1,
      duplicateCopies: 4,
      conflicts: 0,
      invalid: 0,
      failed: 0,
      duplicateBreakdown: { samePath: 0, sameContent: 4, alreadyInDsh: 0 },
      duplicateGroups: [],
      items: [],
      startedAt: 'a',
      finishedAt: 'b',
    }
    const stored = skillsManagerMetadataSchema({
      version: 2,
      externalImportCompleted: true,
      lastScan: { scanId: 's1', startedAt: 'a', finishedAt: 'b', report, records: [] },
      importedProvenance: [
        { skillName: 'foo', originalFingerprint: 'fp', firstImportedAt: 'a', sources: ['claude'] },
      ],
    } as never)
    const back = normalizeMetadata(stored)
    expect(back.version).toBe(2)
    expect(back.lastScan?.report.scannedCandidates).toBe(7)
    expect(back.lastScan?.report.inDsh).toBe(3)
    expect(back.lastScan?.report.importedThisScan).toBe(1)
    expect(back.importedProvenance).toHaveLength(1)
  })

  it('ignores a persisted lastScan that carries no usable report', () => {
    expect(normalizeMetadata({ externalImportCompleted: true, lastScan: {} }).lastScan).toBeUndefined()
    expect(normalizeMetadata({ externalImportCompleted: true, lastScan: { report: {} } }).lastScan).toBeUndefined()
  })

  it('records provenance as history without driving inDsh', async () => {
    const h = await harness()
    try {
      await writeExternalSkill(join(h.dir, 'claude', 'skills'), 'foo')
      await h.scan(['claude'])
      expect(h.metadata.get().importedProvenance?.map(entry => entry.skillName)).toEqual(['foo'])

      // Delete the imported skill: provenance still remembers it, but a fresh
      // scan must report it as newly imported again rather than trusting history.
      await rm(join(h.dshHome, 'skills', 'foo'), { recursive: true, force: true })
      const second = await h.scan(['claude'])
      expect(second.importedThisScan).toBe(1)
      expect(second.inDsh).toBe(1)
    } finally {
      await rm(h.dir, { recursive: true, force: true })
    }
  })
})

describe('DSH duplicate content audit', () => {
  it('Test 51a: distinct DSH skills report no duplicate content groups', async () => {
    const dir = await tempDir()
    try {
      const dshHome = join(dir, 'dsh')
      await writeExternalSkill(join(dshHome, 'skills'), 'foo', 'AAA')
      await writeExternalSkill(join(dshHome, 'skills'), 'bar', 'BBB')
      const audit = await auditDshSkillDuplicates(dshRegistryCtx(dshHome) as never)
      expect(audit.duplicateContentGroups).toHaveLength(0)
      expect(audit.scannedSkills).toBe(2)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('Test 51b: two DSH skills with identical content are reported, not deleted', async () => {
    const dir = await tempDir()
    try {
      const dshHome = join(dir, 'dsh')
      const root = join(dshHome, 'skills')
      await mkdir(join(root, 'foo'), { recursive: true })
      await mkdir(join(root, 'foo-copy'), { recursive: true })
      // Identical bodies AND identical relative layout produce one fingerprint.
      await writeFile(join(root, 'foo', 'SKILL.md'), skillBody('foo', 'AAA'), 'utf8')
      await writeFile(join(root, 'foo-copy', 'SKILL.md'), skillBody('foo', 'AAA'), 'utf8')
      const audit = await auditDshSkillDuplicates(dshRegistryCtx(dshHome) as never)
      expect(audit.duplicateContentGroups).toHaveLength(1)
      expect(audit.duplicateContentGroups[0]?.skills.map(skill => skill.name).sort()).toEqual(['foo', 'foo-copy'])
      // Report-only: nothing is removed.
      expect((await readdir(root)).sort()).toEqual(['foo', 'foo-copy'])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
