import { describe, expect, it, vi } from 'vitest'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSkillAccess } from '../src/skills-access.ts'
import { listManagedSkills, getManagedSkill, deleteManagedSkill } from '../src/skills-service.ts'
import { existingSkillSnapshots } from '../src/import/importer.ts'
import { deduplicateCandidates } from '../src/import/deduplicator.ts'
import { fingerprintSkillPath } from '../src/import/fingerprint.ts'
import type { ExternalSkillCandidate } from '../src/types.ts'

const presetScope = { agentPreset: 'default' }

function summary(name: string, index = 0) {
  return {
    name,
    description: `description ${index}`,
    invocation: { modelInvocable: true, userInvocable: true },
    source: 'user-dsh',
    provider: 'filesystem',
  }
}

function manySummaries(count: number) {
  return Array.from({ length: count }, (_, index) => summary(`skill-${index}`, index))
}

interface MockCtxOptions {
  sessions?: unknown[]
  agents?: { get?: (id: string) => unknown }
  presets?: { standingKeyFor?: () => Promise<unknown> }
  registry?: {
    list?: (options: any) => Promise<any[]>
    get?: (name: string, options: any) => Promise<any>
  }
  logger?: { info?: (...args: any[]) => void; warn?: (...args: any[]) => void; error?: (...args: any[]) => void }
}

function makeCtx(options: MockCtxOptions = {}) {
  const sessions = options.sessions ?? []
  const agents = options.agents ?? {}
  const presets = options.presets
  const registry = options.registry ?? {}
  return {
    get(name: string) {
      switch (name) {
        case 'sessions': return { list: () => sessions }
        case 'agents': return agents
        case 'agentPresets': return presets
        case 'skills': return registry
        default: return undefined
      }
    },
    skills: registry,
    logger: options.logger,
  }
}

function registryWith(presetOnly: any[], globalOnly: any[] = []) {
  const list = vi.fn(async (options: any) => {
    if (options.scope === presetScope) return presetOnly
    return globalOnly
  })
  const get = vi.fn(async (name: string, options: any) => {
    if (options.scope !== presetScope) return undefined
    return {
      name,
      description: `description ${name}`,
      invocation: { modelInvocable: true, userInvocable: true },
      source: 'user-dsh',
      provider: 'filesystem',
      path: `/dsh/skills/${name}/SKILL.md`,
    }
  })
  return { list, get }
}

async function tempDshHome(): Promise<string> {
  return await mkdtemp(join(tmpdir(), 'dsh-skills-scope-'))
}

describe('skills scope resolution', () => {
  it('lists default preset skills when sessions exist but no live agent is available', async () => {
    const registry = registryWith(manySummaries(300))
    const agentsGet = vi.fn(() => undefined)
    const ctx = makeCtx({
      sessions: [{ id: 'stale', agentPreset: 'other', header: { cwd: '/other' } }],
      agents: { get: agentsGet },
      presets: { standingKeyFor: vi.fn(async () => presetScope) },
      registry,
    })

    const rows = await listManagedSkills({ ctx: ctx as never, dshHome: '/tmp/dsh' })

    expect(rows).toHaveLength(300)
    expect(registry.list).toHaveBeenCalledWith(expect.objectContaining({ scope: presetScope }))
    expect(agentsGet).not.toHaveBeenCalled()
  })

  it('lists default preset skills when there are no sessions at all', async () => {
    const registry = registryWith(manySummaries(300))
    const ctx = makeCtx({
      sessions: [],
      presets: { standingKeyFor: vi.fn(async () => presetScope) },
      registry,
    })

    const rows = await listManagedSkills({ ctx: ctx as never, dshHome: '/tmp/dsh' })

    expect(rows).toHaveLength(300)
    expect(registry.list).toHaveBeenCalledWith(expect.objectContaining({ scope: presetScope }))
  })

  it('is not affected by stale first sessions or SessionStore order', async () => {
    const registry = registryWith(manySummaries(3))
    const sessionsList = vi.fn(() => [
      { id: 'stale', agentPreset: 'old', header: { cwd: '/stale' } },
      { id: 'current', agentPreset: 'default', header: { cwd: '/current' } },
    ])
    const ctx = {
      get(name: string) {
        switch (name) {
          case 'sessions': return { list: sessionsList }
          case 'agents': return { get: vi.fn(() => undefined) }
          case 'agentPresets': return { standingKeyFor: vi.fn(async () => presetScope) }
          case 'skills': return registry
          default: return undefined
        }
      },
      skills: registry,
    }

    const rows = await listManagedSkills({ ctx: ctx as never, dshHome: '/tmp/dsh' })

    expect(rows).toHaveLength(3)
    expect(sessionsList).not.toHaveBeenCalled()
  })

  it('uses the default preset standing scope even when the unscoped registry would be empty', async () => {
    const registry = registryWith(manySummaries(12), [])
    const ctx = makeCtx({
      sessions: [],
      presets: { standingKeyFor: vi.fn(async () => presetScope) },
      registry,
    })

    const rows = await listManagedSkills({ ctx: ctx as never, dshHome: '/tmp/dsh' })

    expect(rows).toHaveLength(12)
    expect(registry.list).toHaveBeenCalledWith(expect.objectContaining({ scope: presetScope }))
  })

  it('surfaces a default preset scope resolution failure instead of returning an empty list', async () => {
    const registry = registryWith([], [])
    const ctx = makeCtx({
      presets: {
        standingKeyFor: vi.fn(async () => {
          throw new Error('preset composition is broken')
        }),
      },
      registry,
      logger: { warn: vi.fn() },
    })

    await expect(listManagedSkills({ ctx: ctx as never, dshHome: '/tmp/dsh' }))
      .rejects.toThrow(/failed to resolve default agent preset skill scope/)
  })

  it('keeps list and get on the same resolved scope', async () => {
    const registry = registryWith([summary('foo')])
    const ctx = makeCtx({
      presets: { standingKeyFor: vi.fn(async () => presetScope) },
      registry,
    })

    const access = await createSkillAccess(ctx as never)
    await access.list({})
    await access.get('foo', {})

    expect(registry.list).toHaveBeenCalledWith(expect.objectContaining({ scope: presetScope }))
    expect(registry.get).toHaveBeenCalledWith('foo', expect.objectContaining({ scope: presetScope }))
  })

  it('lets get/delete address skills through the same scope as list', async () => {
    const dir = await tempDshHome()
    try {
      const dshHome = dir
      const skillDir = join(dshHome, 'skills', 'foo')
      await mkdir(skillDir, { recursive: true })
      await writeFile(join(skillDir, 'SKILL.md'), '---\nname: foo\ndescription: d\n---\nBody')
      const skillPath = join(skillDir, 'SKILL.md')
      const registry = {
        list: vi.fn(async (options: any) => options.scope === presetScope ? [summary('foo')] : []),
        get: vi.fn(async (name: string, options: any) => {
          if (options.scope !== presetScope) return undefined
          return {
            name,
            description: 'd',
            invocation: { modelInvocable: true, userInvocable: true },
            source: 'user-dsh',
            provider: 'filesystem',
            path: skillPath,
          }
        }),
      }
      const ctx = makeCtx({
        presets: { standingKeyFor: vi.fn(async () => presetScope) },
        registry,
      })

      const detail = await getManagedSkill({ ctx: ctx as never, dshHome }, 'foo')
      expect(detail.name).toBe('foo')
      expect(registry.get).toHaveBeenCalledWith('foo', expect.objectContaining({ scope: presetScope }))

      await deleteManagedSkill({ ctx: ctx as never, dshHome }, 'foo')
      expect(registry.get).toHaveBeenLastCalledWith('foo', expect.objectContaining({ scope: presetScope }))
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('shows an existing DSH skill in the table and still reports it as duplicate to the importer', async () => {
    const dir = await tempDshHome()
    try {
      const dshHome = dir
      const skillDir = join(dshHome, 'skills', 'foo')
      await mkdir(skillDir, { recursive: true })
      await writeFile(join(skillDir, 'SKILL.md'), '---\nname: foo\ndescription: d\n---\nBody')
      const fingerprint = await fingerprintSkillPath(skillDir)
      const skillPath = join(skillDir, 'SKILL.md')
      const registry = {
        list: vi.fn(async (options: any) => options.scope === presetScope ? [summary('foo')] : []),
        get: vi.fn(async (name: string, options: any) => ({
          name,
          description: 'd',
          invocation: { modelInvocable: true, userInvocable: true },
          source: 'user-dsh',
          provider: 'filesystem',
          path: skillPath,
        })),
      }
      const ctx = makeCtx({
        presets: { standingKeyFor: vi.fn(async () => presetScope) },
        registry,
      })

      const rows = await listManagedSkills({ ctx: ctx as never, dshHome })
      expect(rows.map(row => row.name)).toEqual(['foo'])

      const snapshots = await existingSkillSnapshots(ctx as never)
      expect(snapshots[0]?.name).toBe('foo')
      expect(snapshots[0]?.fingerprint).toBe(fingerprint)

      const candidate: ExternalSkillCandidate = {
        source: 'claude',
        rootPath: join(dir, 'external'),
        skillPath: join(dir, 'external', 'foo'),
        skillMdPath: join(dir, 'external', 'foo', 'SKILL.md'),
        canonicalPath: join(dir, 'external', 'foo'),
        name: 'foo',
        description: 'd',
        fingerprint,
      }
      const dedup = deduplicateCandidates([candidate], snapshots)
      expect(dedup.items[0]?.result).toBe('duplicate')
      expect(dedup.toImport).toHaveLength(0)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('keeps importer dedup idempotent across repeated scans', async () => {
    const dir = await tempDshHome()
    try {
      const dshHome = dir
      const skillDir = join(dshHome, 'skills', 'foo')
      await mkdir(skillDir, { recursive: true })
      await writeFile(join(skillDir, 'SKILL.md'), '---\nname: foo\ndescription: d\n---\nBody')
      const fingerprint = await fingerprintSkillPath(skillDir)
      const skillPath = join(skillDir, 'SKILL.md')
      const registry = {
        list: vi.fn(async (options: any) => options.scope === presetScope ? [summary('foo')] : []),
        get: vi.fn(async (name: string, options: any) => ({
          name,
          description: 'd',
          invocation: { modelInvocable: true, userInvocable: true },
          source: 'user-dsh',
          provider: 'filesystem',
          path: skillPath,
        })),
      }
      const ctx = makeCtx({
        presets: { standingKeyFor: vi.fn(async () => presetScope) },
        registry,
      })

      const candidate: ExternalSkillCandidate = {
        source: 'claude',
        rootPath: join(dir, 'external'),
        skillPath: join(dir, 'external', 'foo'),
        skillMdPath: join(dir, 'external', 'foo', 'SKILL.md'),
        canonicalPath: join(dir, 'external', 'foo'),
        name: 'foo',
        description: 'd',
        fingerprint,
      }

      const first = deduplicateCandidates([candidate], await existingSkillSnapshots(ctx as never))
      const second = deduplicateCandidates([candidate], await existingSkillSnapshots(ctx as never))

      expect(first.items[0]?.result).toBe('duplicate')
      expect(second.items[0]?.result).toBe('duplicate')
      expect(first.toImport).toHaveLength(0)
      expect(second.toImport).toHaveLength(0)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
