/**
 * dsh-skills-manager — browser half.
 *
 * Registers the Settings → Skills section. The section is a pure management
 * UI over DSH's native Skills API; no skill runtime lives here.
 */

import { skillsManagerApi, type SkillsManagerApi } from './api.ts'
import { SkillsSection, type SkillsSectionInjected } from './SkillsSection.tsx'

export type { SkillsManagerApi } from './api.ts'
export type { SkillsSectionInjected, SkillsSectionProps } from './SkillsSection.tsx'

export const inject = ['slots', 'connection', 'remote']

export function apply(ctx: any): void {
  ctx.effect(() => ctx.slots.inject('settings.section', () =>
    ctx.slots.register({
      name: 'settings.section',
      id: 'skills',
      order: 20,
      label: () => 'Skills',
      inject: (): SkillsSectionInjected => ({
        api: skillsManagerApi,
        remote: ctx.get('remote') as SkillsSectionInjected['remote'],
      }),
    }, SkillsSection),
  ), 'dsh-skills-manager: settings section')
}
