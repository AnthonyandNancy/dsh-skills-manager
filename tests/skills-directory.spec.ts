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

  it('opens only the directory returned by the fixed Skills API through the current session Remote', async () => {
    const openWorkspacePath = vi.fn().mockResolvedValue({ ok: true })
    const api = { skillsDirectory: vi.fn().mockResolvedValue({ directory: 'C:/authoritative/dsh/skills' }) }

    await expect(openSkillsDirectory(api, undefined, { openWorkspacePath })).resolves.toBe('C:/authoritative/dsh/skills')
    expect(api.skillsDirectory).toHaveBeenCalledWith()
    expect(openWorkspacePath).toHaveBeenCalledWith({ path: 'C:/authoritative/dsh/skills' })
  })

  it('still opens through the ≤0.1.4 connection facade when a release publishes it', async () => {
    const openPath = vi.fn().mockResolvedValue({ result: { ok: true, value: { opened: true } } })
    const api = { skillsDirectory: vi.fn().mockResolvedValue({ directory: '/dsh/skills' }) }
    const connection = { api: { host: { openPath } } }

    await expect(openSkillsDirectory(api, connection, undefined)).resolves.toBe('/dsh/skills')
    expect(openPath).toHaveBeenCalledWith({ path: '/dsh/skills' })
  })

  it('answers availability per carrier and never off loopback', async () => {
    const canOpenWorkspacePath = vi.fn().mockResolvedValue({ ok: true, value: true })
    const session = { canOpenWorkspacePath }

    expect(await canOpenSkillsDirectory({ isLoopback: true }, undefined, session)).toBe(true)
    expect(canOpenWorkspacePath).toHaveBeenCalledTimes(1)

    // A Host that answers "no", and a Host whose answer fails, both hide the control.
    expect(await canOpenSkillsDirectory({ isLoopback: true }, undefined, { canOpenWorkspacePath: async () => ({ ok: true, value: false }) })).toBe(false)
    expect(await canOpenSkillsDirectory({ isLoopback: true }, undefined, { canOpenWorkspacePath: async () => { throw new Error('offline') } })).toBe(false)

    // Releases that mount no session namespace still answer from their host facts.
    expect(await canOpenSkillsDirectory({ isLoopback: true }, { canOpenPath: true }, undefined)).toBe(true)
    expect(await canOpenSkillsDirectory({ isLoopback: true }, { canOpenPath: false }, undefined)).toBe(false)

    // A remote browser has no Host filesystem to reveal, whatever the carrier says.
    expect(await canOpenSkillsDirectory({ isLoopback: false }, { canOpenPath: true }, session)).toBe(false)
    expect(await canOpenSkillsDirectory(undefined, { canOpenPath: true }, session)).toBe(false)
    expect(canOpenWorkspacePath).toHaveBeenCalledTimes(1)
  })

  it('surfaces opener failures and refuses a release that carries no opener', async () => {
    const api = { skillsDirectory: vi.fn().mockResolvedValue({ directory: '/dsh/skills' }) }
    const legacyFailure = { api: { host: { openPath: vi.fn().mockResolvedValue({ result: { ok: false, error: { message: 'native opener failed' } } }) } } }

    await expect(openSkillsDirectory(api, undefined, { openWorkspacePath: async () => ({ ok: false }) })).rejects.toThrow('refused')
    await expect(openSkillsDirectory(api, legacyFailure, undefined)).rejects.toThrow('native opener failed')
    await expect(openSkillsDirectory(api, undefined, undefined)).rejects.toThrow('no way to open')
  })
})