/**
 * dsh-skills-manager — DSH native Skills visual manager + manual external importer.
 *
 * Host half responsibilities:
 * 1. Register the thin `/skills-manager/api` JSON API used by the Settings →
 *    Skills UI.
 * 2. External imports are manual only: the Settings UI's Scan External Skills
 *    action invokes `import.scan`. Loading this plugin never scans or imports
 *    Claude/Codex/Cursor/Gemini skill roots.
 *
 * This plugin never replaces DSH's Skill Registry/Loader/Runtime. It only
 * reads through `ctx.skills` and writes into DSH-managed skill directories.
 */

import z from '@deepseek-ai/schemastery'
import { createMetadataStore } from './storage.ts'
import { installRoutes } from './routes.ts'

export const name = 'dsh-skills-manager'

export const inject = ['skills']

export interface Config {
  /** DSH home override; defaults to $DSH_HOME or ~/.dsh. */
  dshHome?: string
}

export const Config = z.object({
  dshHome: z.string().default(''),
})

export function apply(ctx: any, config: Config = {}): void {
  const dshHome = config.dshHome === '' ? undefined : config.dshHome
  const metadata = createMetadataStore(ctx)

  installRoutes({ ctx, metadata, dshHome })
}

export default { name, apply }
