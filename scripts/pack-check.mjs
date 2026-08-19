import { access, readFile } from 'node:fs/promises'

const required = [
  'lib/index.js',
  'lib/client.js',
  'cordis.patch.yml',
  'README.md',
  'README.zh.md',
  'LICENSE',
]
for (const file of required) await access(file)

const client = await readFile('lib/client.js', 'utf8')
if (!client.includes('window.__ModuleLoader__.load')) {
  throw new Error('lib/client.js is missing the DSH ModuleLoader registration wrapper')
}
if (!client.includes('dsh-skills-manager')) {
  throw new Error('lib/client.js is missing the dsh-skills-manager module id')
}

const packageJson = JSON.parse(await readFile('package.json', 'utf8'))
if (packageJson.private === true) throw new Error('package.json must be publishable')
if (packageJson.dsh?.bundle?.patch !== './cordis.patch.yml') throw new Error('dsh.bundle.patch is missing')
console.log(`pack:check passed (${required.length} required files, ModuleLoader wrapper present)`)
