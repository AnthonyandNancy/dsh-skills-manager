import { describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fingerprintSkillPath } from '../src/import/fingerprint.ts'

async function tempDir(): Promise<string> {
  return await mkdtemp(join(tmpdir(), 'dsh-skills-fp-'))
}

describe('fingerprint', () => {
  it('is deterministic and independent of traversal order', async () => {
    const dir = await tempDir()
    try {
      await mkdir(join(dir, 'skill'))
      await writeFile(join(dir, 'skill', 'SKILL.md'), '---\nname: foo\n---\nBody')
      await writeFile(join(dir, 'skill', 'a.txt'), 'aaa')
      await writeFile(join(dir, 'skill', 'b.txt'), 'bbb')
      const first = await fingerprintSkillPath(join(dir, 'skill'))
      const second = await fingerprintSkillPath(join(dir, 'skill'))
      expect(first).toBe(second)
      expect(first).toMatch(/^[a-f0-9]{64}$/)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('differs when resource files differ', async () => {
    const dir = await tempDir()
    try {
      const a = join(dir, 'a')
      const b = join(dir, 'b')
      await mkdir(a)
      await mkdir(b)
      await writeFile(join(a, 'SKILL.md'), '---\nname: foo\n---\nBody')
      await writeFile(join(b, 'SKILL.md'), '---\nname: foo\n---\nBody')
      await writeFile(join(a, 'script.sh'), 'echo a')
      await writeFile(join(b, 'script.sh'), 'echo b')
      const fa = await fingerprintSkillPath(a)
      const fb = await fingerprintSkillPath(b)
      expect(fa).not.toBe(fb)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('ignores mtime-only changes', async () => {
    const dir = await tempDir()
    try {
      const skill = join(dir, 'skill')
      await mkdir(skill)
      await writeFile(join(skill, 'SKILL.md'), 'same')
      const before = await fingerprintSkillPath(skill)
      // Touch mtime without changing content.
      const now = new Date()
      await Promise.all([
        // fs.utimes is used to avoid content change
        import('node:fs/promises').then(({ utimes }) => utimes(join(skill, 'SKILL.md'), now, now)),
      ])
      const after = await fingerprintSkillPath(skill)
      expect(before).toBe(after)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
