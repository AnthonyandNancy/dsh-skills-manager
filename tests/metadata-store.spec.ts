import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createFileMetadataStore, createMetadataStore, metadataFilePath } from '../src/storage.ts'

const sample = {
  version: 2 as const,
  externalImportCompleted: true,
  importedProvenance: [
    { skillName: 'foo', originalFingerprint: 'abc', firstImportedAt: '2026-01-01T00:00:00.000Z', sources: ['claude'] },
  ],
}

async function tempHome(): Promise<string> {
  return await mkdtemp(join(tmpdir(), 'dsh-skills-metadata-'))
}

describe('Skills Manager metadata store', () => {
  it('keeps the metadata file below the DSH home', () => {
    expect(metadataFilePath('C:/dsh')).toMatch(/skills-manager[\\/]metadata\.json$/)
    expect(metadataFilePath('C:/dsh')).toContain('dsh')
  })

  it('persists through the file and reloads it in a later process', async () => {
    const home = await tempHome()
    try {
      const path = metadataFilePath(home)
      const first = createFileMetadataStore(path)
      await first.ready()
      await first.save(sample)

      // A second store stands in for the next process: nothing carries over in memory.
      const second = createFileMetadataStore(path)
      await second.ready()
      expect(second.get().externalImportCompleted).toBe(true)
      expect(second.get().importedProvenance?.[0]?.skillName).toBe('foo')
      expect(JSON.parse(await readFile(path, 'utf8'))).toMatchObject({ version: 2, externalImportCompleted: true })
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })

  it('treats a missing or corrupt file as empty instead of failing the surface', async () => {
    const home = await tempHome()
    try {
      const path = metadataFilePath(home)
      const missing = createFileMetadataStore(path)
      await missing.ready()
      expect(missing.get().externalImportCompleted).toBe(false)

      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, '{ not json', 'utf8')
      const corrupt = createFileMetadataStore(path)
      await corrupt.ready()
      expect(corrupt.get().externalImportCompleted).toBe(false)

      // A corrupt file is rewritten whole by the next save.
      await corrupt.save(sample)
      expect(JSON.parse(await readFile(path, 'utf8'))).toMatchObject({ externalImportCompleted: true })
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })

  it('serializes concurrent saves so the last one is the one on disk', async () => {
    const home = await tempHome()
    try {
      const path = metadataFilePath(home)
      const store = createFileMetadataStore(path)
      await store.ready()

      await Promise.all([
        store.save({ version: 2, externalImportCompleted: false }),
        store.save({ version: 2, externalImportCompleted: true }),
        store.save({ version: 2, externalImportCompleted: false, lastScanAt: '2026-01-02T00:00:00.000Z' }),
      ])

      const onDisk = JSON.parse(await readFile(path, 'utf8'))
      expect(onDisk.lastScanAt).toBe('2026-01-02T00:00:00.000Z')
      expect(store.get().lastScanAt).toBe('2026-01-02T00:00:00.000Z')
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })

  it('still persists through the settings namespace while a release exposes register()', async () => {
    const replaced: unknown[] = []
    const namespace = {
      get: () => ({ version: 2, externalImportCompleted: true }),
      replace: async (value: unknown) => { replaced.push(value) },
    }
    const register = vi.fn(() => namespace)
    const ctx = { inject: (_names: string[], callback: (scope: unknown) => void) => { callback({ settings: { register } }) } }

    const store = createMetadataStore(ctx as never, { dshHome: '/tmp/unused-dsh-home' })
    await store.ready()

    expect(register).toHaveBeenCalledTimes(1)
    expect(store.get().externalImportCompleted).toBe(true)

    await store.save({ version: 2, externalImportCompleted: false })
    expect(replaced).toEqual([{ version: 2, externalImportCompleted: false }])
  })

  it('falls back to its own file when the settings seam registers no namespaces (0.1.7)', async () => {
    const home = await tempHome()
    try {
      // 0.1.7's ctx.settings is SettingsForms: describe/update/configure, no register.
      const ctx = { inject: (_names: string[], callback: (scope: unknown) => void) => { callback({ settings: { describe: () => ({}) } }) } }

      const store = createMetadataStore(ctx as never, { dshHome: home })
      await store.ready()
      expect(store.get().externalImportCompleted).toBe(false)

      await store.save(sample)
      const onDisk = JSON.parse(await readFile(metadataFilePath(home), 'utf8'))
      expect(onDisk.externalImportCompleted).toBe(true)
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })
})