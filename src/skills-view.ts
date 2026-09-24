/**
 * Unified DSH Skills view resolver for the Skills Manager surface.
 *
 * Settings → Skills is a manager surface with no explicit session. It must not
 * guess a scope from `sessions.list()[0]`; instead it reads the host Skill
 * Registry through the default agent preset's standing scope. That is what
 * makes preset-owned providers (e.g. `skill-filesystem` mounted by the default
 * preset composition) visible to the manager, including before any session or
 * agent exists.
 *
 * That one scope read spans two DSH generations of the same seam:
 * - ≤0.1.6 `agentPresets.standingKeyFor()` resolves the default preset and
 *   hands back its scope key.
 * - ≥0.1.7 `agentPresets.acquireScope()` hands back a reference LEASE over the
 *   already-mounted preset revision instead. The lease keeps that generation
 *   alive, so an unreleased one pins a retired preset subtree forever: every
 *   reader must dispose it, which is what {@link withSkillsManagerView} is for.
 *   DSH's own session-bound catalog reads its scope the same way (see
 *   `packages/api/session-controller/src/skill-catalog.ts` `scopeFor`).
 *
 * Either resolution can fail — a preset the user is still migrating, a broken
 * composition. That is a scope failure, not a skill failure, so the manager
 * falls back to the global registry layer and says so in diagnostics: no skill
 * lookup can repair a preset, and `scopeSource: 'none'` keeps the degradation
 * visible instead of taking the whole management surface down.
 */

export interface SkillsManagerView {
  /** The host Skill Registry service (`ctx.skills`). */
  readonly registry: any
  /** The deterministic view scope, or `undefined` for a host-only global view. */
  readonly scope?: unknown
  /** Why this scope was chosen; used in diagnostics. */
  readonly scopeSource: 'default-preset' | 'none'
  /**
   * Release the preset reference this view holds. Present only when the
   * running DSH leases the scope (≥0.1.7 `acquireScope()`); a release that
   * hands back a bare scope key has nothing to release.
   */
  readonly release?: () => Promise<void>
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

/** `Symbol.asyncDispose` when the host runtime provides it (Node ≥ 20.4). */
const ASYNC_DISPOSE = (Symbol as unknown as { asyncDispose?: symbol }).asyncDispose

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Build the release hook of one `acquireScope()` lease, or `undefined` when the runtime cannot dispose one. */
function leaseRelease(lease: unknown): (() => Promise<void>) | undefined {
  if (ASYNC_DISPOSE === undefined) return undefined
  const dispose = (lease as Record<symbol, unknown> | undefined)?.[ASYNC_DISPOSE]
  if (typeof dispose !== 'function') return undefined
  return async () => { await (dispose as () => unknown).call(lease) }
}

function warnUnusableScope(ctx: SkillsViewContext, error: unknown): void {
  ctx.logger?.warn?.(
    '[dsh-skills-manager] default agent preset scope unavailable; listing the global skill layer instead: %s',
    messageOf(error),
  )
}

/**
 * Resolve the Skill Registry and the default preset standing scope for the
 * Skills Manager.
 *
 * - Without an `agentPresets` service, or without a scope reader this release
 *   documents, the view is the global registry layer.
 * - A failure to resolve the preset scope is warned about and degrades to the
 *   global layer; it is never fatal.
 *
 * Prefer {@link withSkillsManagerView} over calling this directly: a ≥0.1.7
 * lease must be released, including when the read that used it throws.
 * @param ctx - host context carrying `skills` and (optionally) `agentPresets`.
 * @returns the registry, the chosen scope, and the release hook for it.
 */
export async function resolveSkillsManagerView(ctx: SkillsViewContext): Promise<SkillsManagerView> {
  const registry = ctx.get?.('skills') ?? ctx.skills
  if (registry === undefined) {
    throw new Error('DSH skills service is not available')
  }

  const presets = ctx.get?.('agentPresets')
  if (presets === undefined) {
    return { registry, scopeSource: 'none' }
  }

  if (typeof presets.acquireScope === 'function') {
    try {
      const lease = await presets.acquireScope()
      const scope = (lease as { key?: unknown } | undefined)?.key
      const release = leaseRelease(lease)
      if (scope === undefined) {
        await release?.()
        return { registry, scopeSource: 'none' }
      }
      return { registry, scope, scopeSource: 'default-preset', ...release === undefined ? {} : { release } }
    } catch (error) {
      warnUnusableScope(ctx, error)
      return { registry, scopeSource: 'none' }
    }
  }

  if (typeof presets.standingKeyFor === 'function') {
    try {
      const scope = await presets.standingKeyFor()
      return { registry, scope, scopeSource: 'default-preset' }
    } catch (error) {
      warnUnusableScope(ctx, error)
      return { registry, scopeSource: 'none' }
    }
  }

  return { registry, scopeSource: 'none' }
}

/**
 * Run one read against a freshly resolved view, then release it.
 *
 * Each read resolves and releases its own scope reference: holding a lease
 * across requests would keep a retired preset subtree mounted, and holding it
 * across an unrelated failure would never release it at all.
 * @param ctx - host context carrying `skills`/`agentPresets`.
 * @param read - the scoped read, given the view it must use.
 * @returns whatever `read` returns.
 */
export async function withSkillsManagerView<T>(
  ctx: SkillsViewContext,
  read: (view: SkillsManagerView) => Promise<T>,
): Promise<T> {
  const view = await resolveSkillsManagerView(ctx)
  try {
    return await read(view)
  } finally {
    if (view.release !== undefined) {
      try {
        await view.release()
      } catch (error) {
        ctx.logger?.warn?.(
          '[dsh-skills-manager] failed to release the default agent preset scope lease: %s',
          messageOf(error),
        )
      }
    }
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