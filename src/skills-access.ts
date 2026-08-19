/**
 * Access helper for DSH's native Skills registry.
 *
 * DSH may mount the filesystem skill provider in an agent-preset scope rather
 * than the global layer (the host `/api/skill.list` follows the same rule).
 * Settings → Skills is a manager surface with no explicit session, so this
 * helper deliberately does NOT use `sessions.list()[0]` or `serviceFor()`.
 * Instead it resolves the default agent preset's standing scope, which makes
 * preset-owned skill providers visible even when no session or live agent
 * exists yet.
 */

import { resolveSkillsManagerView, type SkillsManagerView } from './skills-view.ts'

export interface SkillAccess {
  /** The resolved view; useful for diagnostics and shared list/get scoping. */
  readonly view: SkillsManagerView
  list(options?: { cwd?: string; signal?: AbortSignal }): Promise<any[]>
  get(name: string, options?: { cwd?: string; signal?: AbortSignal }): Promise<any | undefined>
}

export async function createSkillAccess(ctx: {
  get?: (name: string) => any
  skills?: any
  logger?: { info?: (...args: any[]) => void; warn?: (...args: any[]) => void; error?: (...args: any[]) => void }
}): Promise<SkillAccess> {
  const view = await resolveSkillsManagerView(ctx)

  return {
    view,
    async list(options) {
      return await view.registry.list({ ...(options ?? {}), ...(view.scope === undefined ? {} : { scope: view.scope }) })
    },
    async get(name, options) {
      return await view.registry.get(name, { ...(options ?? {}), ...(view.scope === undefined ? {} : { scope: view.scope }) })
    },
  }
}
