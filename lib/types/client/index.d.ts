/**
 * dsh-skills-manager — browser half.
 *
 * Registers the Settings → Skills section. The section is a pure management
 * UI over DSH's native Skills API; no skill runtime lives here.
 */
export type { SkillsManagerApi } from './api.ts';
export type { SkillsSectionInjected, SkillsSectionProps } from './SkillsSection.tsx';
export { SKILLS_MANAGER_NS, en, zh } from './locale.ts';
/**
 * The browser-side services this half touches, as one structural contract.
 *
 * DSH never exported a shared client-runtime type from the compositions this
 * plugin supports — `@deepseek-ai/dsh-client-runtime` stopped publishing at
 * 0.0.1-rc.1 while every release in between still built a browser half — so
 * the plugin names the surface it actually uses. The runtime guard below stays
 * the authority on whether a loaded context really provides it.
 */
export interface SkillsManagerClientContext {
    effect(callback: () => unknown, label?: string): unknown;
    get(name: string): unknown;
    locale: {
        register(namespace: string, dictionaries: Record<string, unknown>): unknown;
        bind(namespace: string): (key: string, params?: Record<string, unknown>) => string;
    };
    slots: {
        inject(key: string, callback: () => unknown): unknown;
        register(options: unknown, component: unknown): unknown;
    };
}
export declare const inject: string[];
export declare function apply(ctx: SkillsManagerClientContext): void;
//# sourceMappingURL=index.d.ts.map