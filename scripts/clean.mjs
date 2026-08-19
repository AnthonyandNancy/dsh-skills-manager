import { readdir, rm } from 'node:fs/promises'

await rm('lib', { recursive: true, force: true })
for (const entry of await readdir('.')) {
  if (entry.endsWith('.tgz')) await rm(entry, { force: true })
}
