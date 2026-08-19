/**
 * Access helper for DSH's native Skills registry.
 *
 * DSH may mount the filesystem skill provider in an agent-preset scope rather
 * than the global layer (the host `/api/skill.list` follows the same rule).
 * This helper resolves the first live session's agent as the viewing scope so
 * Settings → Skills sees the same catalog the running agent sees, and falls
 * back to the global registry when no live session exists.
 */

export interface SkillAccess {
  list(options?: { cwd?: string; signal?: AbortSignal }): Promise<any[]>
  get(name: string, options?: { cwd?: string; signal?: AbortSignal }): Promise<any | undefined>
}

export async function createSkillAccess(ctx: { get?: (name: string) => any }): Promise<SkillAccess> {
  const sessions = ctx.get?.('sessions')
  const first = sessions?.list?.()?.[0]
  const live = first === undefined ? undefined : ctx.get?.('agents')?.get?.(first.id)
  const presets = ctx.get?.('agentPresets')
  const scoped = live === undefined ? undefined : presets?.serviceFor?.(live, 'skills')
  const skills = scoped ?? ctx.get?.('skills')
  if (skills === undefined) throw new Error('DSH skills service is not available')

  let scope: unknown = live
  if (scope === undefined && first?.agentPreset !== undefined && presets?.standingKeyFor !== undefined) {
    try {
      scope = await presets.standingKeyFor(first.agentPreset)
    } catch {
      scope = undefined
    }
  }

  return {
    async list(options) {
      return await skills.list({ ...(options ?? {}), ...(scope === undefined ? {} : { scope }) })
    },
    async get(name, options) {
      return await skills.get(name, { ...(options ?? {}), ...(scope === undefined ? {} : { scope }) })
    },
  }
}
