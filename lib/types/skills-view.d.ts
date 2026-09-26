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
    readonly registry: any;
    /** The deterministic view scope, or `undefined` for a host-only global view. */
    readonly scope?: unknown;
    /** Why this scope was chosen; used in diagnostics. */
    readonly scopeSource: 'default-preset' | 'none';
    /**
     * Release the preset reference this view holds. Present only when the
     * running DSH leases the scope (≥0.1.7 `acquireScope()`); a release that
     * hands back a bare scope key has nothing to release.
     */
    readonly release?: () => Promise<void>;
}
export interface SkillsViewContext {
    readonly get?: (name: string) => any;
    readonly skills?: any;
    readonly logger?: {
        info?: (...args: any[]) => void;
        warn?: (...args: any[]) => void;
        error?: (...args: any[]) => void;
    };
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
export declare function resolveSkillsManagerView(ctx: SkillsViewContext): Promise<SkillsManagerView>;
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
export declare function withSkillsManagerView<T>(ctx: SkillsViewContext, read: (view: SkillsManagerView) => Promise<T>): Promise<T>;
/** Apply the resolved view's scope to one registry lookup. */
export declare function withViewScope(view: SkillsManagerView, options?: {
    cwd?: string;
    signal?: AbortSignal;
}): {
    cwd?: string;
    signal?: AbortSignal;
    scope?: unknown;
};
