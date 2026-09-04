import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as Record<string, any>

describe('publishable DSH Bundle metadata', () => {
  it('declares a bundle patch and prebuilt client export', () => {
    expect(packageJson.private).not.toBe(true)
    expect(packageJson.dsh.bundle.patch).toBe('./cordis.patch.yml')
    expect(packageJson.dsh.client.inject).toContain('@deepseek-ai/dsh-client-ui-primitives')
    expect(packageJson.exports['./client'].default).toBe('./lib/client.js')
    expect(packageJson.files).toEqual(expect.arrayContaining(['lib', 'cordis.patch.yml', 'README.md', 'README.zh.md', 'LICENSE']))
    expect(packageJson.scripts.prepack).toBeTruthy()
  })
})
