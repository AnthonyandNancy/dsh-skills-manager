/**
 * dsh-skills-manager — DSH native Skills visual manager + external importer.
 *
 * Host half responsibilities:
 * 1. Register the thin `/skills-manager/api` JSON API used by the Settings →
 *    Skills UI.
 * 2. On first initialization, run the external Agent Skills import pipeline
 *    once (Claude, Codex, Cursor, Gemini). The pipeline is idempotent, so a
 *    re-run after lost metadata or plugin reinstall never duplicates skills.
 *
 * This plugin never replaces DSH's Skill Registry/Loader/Runtime. It only
 * reads through `ctx.skills` and writes into DSH-managed skill directories.
 */

import z from '@deepseek-ai/schemastery'
import { createMetadataStore } from './storage.ts'
import { installRoutes } from './routes.ts'
import { runExternalImport } from './import/importer.ts'

export const name = 'dsh-skills-manager'

export const inject = ['skills']

export interface Config {
  /** Run the external import automatically when the plugin first initializes. */
  autoImportOnStart: boolean
  /** DSH home override; defaults to $DSH_HOME or ~/.dsh. */
  dshHome?: string
}

export const Config = z.object({
  autoImportOnStart: z.boolean().default(true),
  dshHome: z.string().default(''),
})

export function apply(ctx: any, config: Config = { autoImportOnStart: true }): void {
  const dshHome = config.dshHome === '' ? undefined : config.dshHome
  const metadata = createMetadataStore(ctx)

  installRoutes({ ctx, metadata, dshHome })

  if (config.autoImportOnStart) {
    const alreadyCompleted = metadata.get().externalImportCompleted
    if (!alreadyCompleted) {
      // Defer so startup is never blocked by a large external scan.
      queueMicrotask(() => {
        void runExternalImport({ ctx, metadata, dshHome })
          .then(report => {
            ctx.logger?.info?.(
              '[dsh-skills-manager] first-run external import finished: candidates=%d uniqueSkills=%d inDsh=%d importedThisScan=%d duplicateCopies=%d conflicts=%d invalid=%d',
              report.scannedCandidates,
              report.uniqueValidSkills,
              report.inDsh,
              report.importedThisScan,
              report.duplicateCopies,
              report.conflicts,
              report.invalid,
            )
          })
          .catch(error => {
            ctx.logger?.warn?.('[dsh-skills-manager] first-run external import failed: %s', String(error))
          })
      })
    }
  }
}

export default { name, apply }
