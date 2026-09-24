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
 *
 * The scope is resolved per read and released the moment that read settles:
 * DSH ≥0.1.7 hands back a reference lease, and a lease left open pins the
 * preset generation it keeps alive (see `skills-view.ts`). Readers that issue
 * more than one registry call — a list plus one load per row — should use
 * {@link SkillAccess.withView}, so the batch holds exactly one lease.
 */

import { withSkillsManagerView, withViewScope, type SkillsManagerView, type SkillsViewContext } from './skills-view.ts'

export interface SkillAccess {
  /** Run one read batch inside a single, already-scoped view. */
  withView<T>(read: (view: SkillsManagerView) => Promise<T>): Promise<T>
  list(options?: { cwd?: string; signal?: AbortSignal }): Promise<any[]>
  get(name: string, options?: { cwd?: string; signal?: AbortSignal }): Promise<any | undefined>
}

export async function createSkillAccess(ctx: SkillsViewContext): Promise<SkillAccess> {
  const registry = ctx.get?.('skills') ?? ctx.skills
  if (registry === undefined) {
    throw new Error('DSH skills service is not available')
  }

  const withView = <T>(read: (view: SkillsManagerView) => Promise<T>): Promise<T> =>
    withSkillsManagerView(ctx, read)

  return {
    withView,
    async list(options) {
      return await withView(view => view.registry.list(withViewScope(view, options ?? {})))
    },
    async get(name, options) {
      return await withView(view => view.registry.get(name, withViewScope(view, options ?? {})))
    },
  }
}