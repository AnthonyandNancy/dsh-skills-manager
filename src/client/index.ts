/**
 * dsh-skills-manager — browser half.
 *
 * Registers the Settings → Skills section. The section is a pure management
 * UI over DSH's native Skills API; no skill runtime lives here.
 */

import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import { isClientContextCompatible } from './compat.ts'
// Type-only imports merge the current DSH locale and settings-slot contracts.
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { skillsManagerApi, type SkillsManagerApi } from './api.ts'
import { SkillsSection, type SkillsSectionInjected } from './SkillsSection.tsx'
import { en, SKILLS_MANAGER_NS, zh } from './locale.ts'

export type { SkillsManagerApi } from './api.ts'
export type { SkillsSectionInjected, SkillsSectionProps } from './SkillsSection.tsx'
export { SKILLS_MANAGER_NS, en, zh } from './locale.ts'

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
  effect(callback: () => unknown, label?: string): unknown
  get(name: string): unknown
  locale: {
    register(namespace: string, dictionaries: Record<string, unknown>): unknown
    bind(namespace: string): (key: string, params?: Record<string, unknown>) => string
  }
  slots: {
    inject(key: string, callback: () => unknown): unknown
    register(options: unknown, component: unknown): unknown
  }
}

export const inject = ['slots', 'locale', 'connection', 'remote']

export function apply(ctx: SkillsManagerClientContext): void {
  if (!isClientContextCompatible(ctx)) return
  ctx.effect(() => ctx.locale.register(SKILLS_MANAGER_NS, { zh, en }), 'dsh-skills-manager: dictionaries')
  const t = ctx.locale.bind(SKILLS_MANAGER_NS)
  ctx.slots.inject('settings.section', () =>
    ctx.slots.register({
      name: 'settings.section',
      id: 'skills',
      order: 20,
      label: () => t('nav.title'),
      locale: SKILLS_MANAGER_NS,
      inject: (): SkillsSectionInjected => ({
        api: skillsManagerApi,
        connection: ctx.get('connection') as ConnectionHandle,
        remote: ctx.get('remote') as SkillsSectionInjected['remote'],
      }),
    }, SkillsSection),
  )
}