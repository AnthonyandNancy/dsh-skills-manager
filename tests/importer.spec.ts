import { describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm, access, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { importCandidate } from '../src/import/importer.ts'
import { fingerprintSkillPath } from '../src/import/fingerprint.ts'
import { deleteManagedSkill } from '../src/skills-service.ts'
import type { ExternalSkillCandidate } from '../src/types.ts'

async function tempDir(): Promise<string> {
  return await mkdtemp(join(tmpdir(), 'dsh-skills-import-'))
}

describe('importer safety', () => {
  it('imports an external directory bundle into DSH managed root', async () => {
    const dir = await tempDir()
    try {
      const external = join(dir, 'claude', 'foo')
      const dshHome = join(dir, 'dsh')
      await mkdir(external, { recursive: true })
      await writeFile(join(external, 'SKILL.md'), '---\nname: foo\ndescription: d\n---\nBody')
      await writeFile(join(external, 'script.sh'), 'echo hi')
      const candidate: ExternalSkillCandidate = {
        source: 'claude',
        rootPath: join(dir, 'claude'),
        skillPath: external,
        skillMdPath: join(external, 'SKILL.md'),
        canonicalPath: external,
        name: 'foo',
        description: 'd',
        fingerprint: 'fp',
      }
      const target = await importCandidate(candidate, join(dshHome, 'skills'))
      await access(target)
      expect(await readFile(join(target, 'SKILL.md'), 'utf8')).toContain('name: foo')
      expect(await readFile(join(target, 'script.sh'), 'utf8')).toBe('echo hi')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('does not overwrite an identical existing DSH skill and reports duplicate', async () => {
    const dir = await tempDir()
    try {
      const external = join(dir, 'claude', 'foo')
      const dshHome = join(dir, 'dsh')
      const managed = join(dshHome, 'skills', 'foo')
      await mkdir(external, { recursive: true })
      await mkdir(managed, { recursive: true })
      await writeFile(join(external, 'SKILL.md'), '---\nname: foo\ndescription: d\n---\nBody')
      await writeFile(join(managed, 'SKILL.md'), '---\nname: foo\ndescription: d\n---\nBody')
      const candidate: ExternalSkillCandidate = {
        source: 'claude',
        rootPath: join(dir, 'claude'),
        skillPath: external,
        skillMdPath: join(external, 'SKILL.md'),
        canonicalPath: external,
        name: 'foo',
        description: 'd',
        fingerprint: await fingerprintSkillPath(external),
      }
      await expect(importCandidate(candidate, join(dshHome, 'skills')))
        .rejects.toMatchObject({ conflict: false })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('does not overwrite a conflicting existing DSH skill', async () => {
    const dir = await tempDir()
    try {
      const external = join(dir, 'claude', 'foo')
      const dshHome = join(dir, 'dsh')
      const managed = join(dshHome, 'skills', 'foo')
      await mkdir(external, { recursive: true })
      await mkdir(managed, { recursive: true })
      await writeFile(join(external, 'SKILL.md'), '---\nname: foo\ndescription: d\n---\nBody')
      await writeFile(join(managed, 'SKILL.md'), '---\nname: foo\ndescription: d\n---\nDifferent')
      const candidate: ExternalSkillCandidate = {
        source: 'claude',
        rootPath: join(dir, 'claude'),
        skillPath: external,
        skillMdPath: join(external, 'SKILL.md'),
        canonicalPath: external,
        name: 'foo',
        description: 'd',
        fingerprint: await fingerprintSkillPath(external),
      }
      await expect(importCandidate(candidate, join(dshHome, 'skills')))
        .rejects.toMatchObject({ conflict: true })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('deleteManagedSkill never deletes external source files', async () => {
    const dir = await tempDir()
    try {
      const external = join(dir, 'claude', 'foo')
      const dshHome = join(dir, 'dsh')
      const managed = join(dshHome, 'skills', 'foo')
      await mkdir(external, { recursive: true })
      await mkdir(managed, { recursive: true })
      await writeFile(join(external, 'SKILL.md'), 'external')
      await writeFile(join(managed, 'SKILL.md'), 'managed')

      const ctx = {
        skills: {
          get: async (name: string) => ({
            name,
            path: join(managed, 'SKILL.md'),
            content: 'managed',
            description: 'd',
            source: 'user-dsh',
            provider: 'filesystem',
            invocation: { modelInvocable: true, userInvocable: true },
          }),
        },
      } as never

      await deleteManagedSkill({ ctx: ctx as never, dshHome }, 'foo')
      await expect(access(join(managed, 'SKILL.md'))).rejects.toThrow()
      await expect(access(join(external, 'SKILL.md'))).resolves.toBeUndefined()
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
