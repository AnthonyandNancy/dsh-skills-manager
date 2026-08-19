/**
 * Unified DSH Skills view resolver for the Skills Manager surface.
 *
 * Settings → Skills is a manager surface with no explicit session. It must not
 * guess a scope from `sessions.list()[0]`; instead it reads the host Skill
 * Registry through the default agent preset's standing scope. That is what
 * makes preset-owned providers (e.g. `skill-filesystem` mounted by the default
 * preset composition) visible to the manager, including before any session or
 * agent exists.
 */

export interface SkillsManagerView {
  /** The host Skill Registry service (`ctx.skills`). */
  readonly registry: any
  /** The deterministic view scope, or `undefined` for a host-only global view. */
  readonly scope?: unknown
  /** Why this scope was chosen; used in diagnostics. */
  readonly scopeSource: 'default-preset' | 'none'
}

export interface SkillsViewContext {
  readonly get?: (name: string) => any
  readonly skills?: any
  readonly logger?: {
    info?: (...args: any[]) => void
    warn?: (...args: any[]) => void
    error?: (...args: any[]) => void
  }
}

/**
 * Resolve the Skill Registry and the default preset standing scope for the
 * Skills Manager.
 *
 * - If `agentPresets` is unavailable, fall back to the global registry layer.
 * - If `agentPresets` is available, `standingKeyFor()` (no id = default preset)
 *   is the only acceptable manager-scope source. A failure is surfaced as an
 *   error instead of being silently treated as "no skills".
 */
export async function resolveSkillsManagerView(ctx: SkillsViewContext): Promise<SkillsManagerView> {
  const registry = ctx.get?.('skills') ?? ctx.skills
  if (registry === undefined) {
    throw new Error('DSH skills service is not available')
  }

  const presets = ctx.get?.('agentPresets')
  if (presets === undefined || typeof presets.standingKeyFor !== 'function') {
    return { registry, scopeSource: 'none' }
  }

  try {
    const scope = await presets.standingKeyFor()
    return { registry, scope, scopeSource: 'default-preset' }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    ctx.logger?.warn?.('[dsh-skills-manager] failed to resolve default agent preset skill scope: %s', message)
    throw new Error(`failed to resolve default agent preset skill scope: ${message}`)
  }
}

/** Apply the resolved view's scope to one registry lookup. */
export function withViewScope(
  view: SkillsManagerView,
  options: { cwd?: string; signal?: AbortSignal } = {},
): { cwd?: string; signal?: AbortSignal; scope?: unknown } {
  return {
    ...options,
    ...(view.scope === undefined ? {} : { scope: view.scope }),
  }
}
