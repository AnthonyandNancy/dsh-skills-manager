/**
 * dsh-skills-manager — browser half.
 *
 * Registers the Settings → Skills section. The section is a pure management
 * UI over DSH's native Skills API; no skill runtime lives here.
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only imports merge the current DSH locale and settings-slot contracts.
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { skillsManagerApi, type SkillsManagerApi } from './api.ts'
import { SkillsSection, type SkillsSectionInjected } from './SkillsSection.tsx'
import { en, SKILLS_MANAGER_NS, zh } from './locale.ts'

export type { SkillsManagerApi } from './api.ts'
export type { SkillsSectionInjected, SkillsSectionProps } from './SkillsSection.tsx'
export { SKILLS_MANAGER_NS, en, zh } from './locale.ts'

export const inject = ['slots', 'locale', 'connection', 'remote']

export function apply(ctx: ClientContext): void {
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
        remote: ctx.get('remote') as SkillsSectionInjected['remote'],
      }),
    }, SkillsSection),
  )
}
