import { describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { discoverExternalSkills } from '../src/import/scanner.ts'
import type { ExternalSkillSource } from '../src/types.ts'

async function tempDir(): Promise<string> {
  return await mkdtemp(join(tmpdir(), 'dsh-skills-scan-'))
}

function source(root: string, id: 'claude' | 'codex' | 'cursor' | 'gemini'): ExternalSkillSource {
  return { id, label: id, getSkillRoots: () => [root] }
}

describe('scanner', () => {
  it('detects Claude/Codex/Cursor/Gemini directory-bundle skills', async () => {
    const dir = await tempDir()
    try {
      const roots = new Map<string, string>()
      for (const id of ['claude', 'codex', 'cursor', 'gemini'] as const) {
        const root = join(dir, id)
        await mkdir(join(root, 'foo'), { recursive: true })
        await writeFile(join(root, 'foo', 'SKILL.md'), `---\nname: foo\ndescription: test skill\n---\n`)
        roots.set(id, root)
      }
      const sources = [...roots.entries()].map(([id, root]) => source(root, id as 'claude' | 'codex' | 'cursor' | 'gemini'))
      const result = await discoverExternalSkills(sources)
      expect(result.candidates).toHaveLength(4)
      expect(new Set(result.candidates.map(c => c.source))).toEqual(new Set(['claude', 'codex', 'cursor', 'gemini']))
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('treats a missing directory as empty, not an error', async () => {
    const dir = await tempDir()
    try {
      const result = await discoverExternalSkills([source(join(dir, 'missing'), 'claude')])
      expect(result.candidates).toHaveLength(0)
      expect(result.invalid).toHaveLength(0)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('marks invalid SKILL.md as invalid without failing the scan', async () => {
    const dir = await tempDir()
    try {
      const root = join(dir, 'root')
      await mkdir(join(root, 'bad'), { recursive: true })
      await writeFile(join(root, 'bad', 'SKILL.md'), 'not frontmatter')
      await mkdir(join(root, 'good'), { recursive: true })
      await writeFile(join(root, 'good', 'SKILL.md'), '---\nname: good\ndescription: valid skill\n---\n')
      const result = await discoverExternalSkills([source(root, 'codex')])
      expect(result.candidates).toHaveLength(1)
      expect(result.invalid).toHaveLength(1)
      expect(result.invalid[0]?.reason).toContain('frontmatter')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('skips broken symlinks without failing', async () => {
    const dir = await tempDir()
    try {
      const root = join(dir, 'root')
      await mkdir(root, { recursive: true })
      await symlink(join(dir, 'does-not-exist'), join(root, 'broken'))
      const result = await discoverExternalSkills([source(root, 'cursor')])
      expect(result.candidates).toHaveLength(0)
      expect(result.invalid).toHaveLength(0)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
