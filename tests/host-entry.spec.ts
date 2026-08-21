import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  runExternalImport: vi.fn(),
  ensureDshSkillsRoot: vi.fn(),
  reportFromMetadata: vi.fn(),
  auditDshSkillDuplicates: vi.fn(),
}))

vi.mock('../src/import/importer.ts', () => mocks)

import { apply, Config } from '../src/index.ts'

function stubCtx() {
  return {
    inject: () => {},
    logger: { info: vi.fn(), warn: vi.fn() },
  }
}

describe('host entry', () => {
  it('does not expose a startup auto-import config', () => {
    expect(Config({})).not.toHaveProperty('autoImportOnStart')
  })

  it('does not run the external importer while loading', async () => {
    apply(stubCtx() as never, { dshHome: '/tmp/dsh-skills-manager-test' })
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(mocks.runExternalImport).not.toHaveBeenCalled()
  })
})
