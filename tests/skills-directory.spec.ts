import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { ensureDshSkillsRoot, resolveDshSkillsRoot } from '../src/import/importer.ts'
import { canOpenSkillsDirectory, openSkillsDirectory } from '../src/client/open-skills-folder.ts'

describe('fixed DSH skills directory', () => {
  it('resolves the Host directory under dshHome/skills', () => {
    expect(resolveDshSkillsRoot('C:/dsh-home')).toMatch(/[\\/]skills$/)
    expect(resolveDshSkillsRoot('C:/dsh-home')).toContain('dsh-home')
  })

  it('creates the directory recursively when the Host action is used', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-skills-manager-'))
    try {
      const directory = await ensureDshSkillsRoot(home)
      const { stat } = await import('node:fs/promises')
      expect((await stat(directory)).isDirectory()).toBe(true)
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })

  it('opens only the directory returned by the fixed Skills API', async () => {
    const openPath = vi.fn().mockResolvedValue({ result: { ok: true, value: { opened: true } } })
    const api = { skillsDirectory: vi.fn().mockResolvedValue({ directory: 'C:/authoritative/dsh/skills' }) }
    const connection = { api: { host: { openPath } } } as any

    await expect(openSkillsDirectory(api, connection)).resolves.toBe('C:/authoritative/dsh/skills')
    expect(api.skillsDirectory).toHaveBeenCalledWith()
    expect(openPath).toHaveBeenCalledWith({ path: 'C:/authoritative/dsh/skills' })
  })

  it('blocks unavailable capabilities and surfaces official opener failures', async () => {
    expect(canOpenSkillsDirectory(undefined, { canOpenPath: true })).toBe(false)
    expect(canOpenSkillsDirectory({ isLoopback: false }, { canOpenPath: true })).toBe(false)
    expect(canOpenSkillsDirectory({ isLoopback: true }, { canOpenPath: false })).toBe(false)
    expect(canOpenSkillsDirectory({ isLoopback: true }, { canOpenPath: true })).toBe(true)

    const api = { skillsDirectory: vi.fn().mockResolvedValue({ directory: '/dsh/skills' }) }
    const connection = { api: { host: { openPath: vi.fn().mockResolvedValue({ result: { ok: false, error: { message: 'native opener failed' } } }) } } } as any
    await expect(openSkillsDirectory(api, connection)).rejects.toThrow('native opener failed')
  })
})
