import { existsSync, mkdirSync, readdirSync, rmSync, symlinkSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const localTsc = join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc')

function findCheckout() {
  const candidates = [
    process.env.DSH_CHECKOUT,
    join(process.env.HOME ?? '', 'dsh-harness'),
    join(process.env.HOME ?? '', 'dsh'),
    join(process.env.HOME ?? '', '.dsh', 'dsh-harness'),
    resolve(root, '..', 'dsh-harness'),
    resolve(root, '..', 'dsh'),
  ].filter(value => value !== undefined && value.length > 0)
  return candidates.find(candidate => existsSync(join(candidate, 'packages')))
}

function run(command, args, cwd = root) {
  execFileSync(command, args, { cwd, stdio: 'inherit', env: process.env, shell: process.platform === 'win32' })
}

function linkPackage(checkout, packageName, relativePath) {
  const target = join(checkout, relativePath)
  if (!existsSync(target)) throw new Error(`build: dependency target missing: ${target}`)
  const destination = join(root, 'node_modules', ...packageName.split('/'))
  rmSync(destination, { recursive: true, force: true })
  mkdirSync(dirname(destination), { recursive: true })
  symlinkSync(target, destination, process.platform === 'win32' ? 'junction' : 'dir')
}

const checkout = findCheckout()
if (checkout === undefined) {
  if (existsSync(localTsc) && (existsSync(join(root, 'node_modules', 'schemastery')) || existsSync(join(root, 'node_modules', '@deepseek-ai', 'schemastery')))) {
    run(localTsc, ['-p', 'tsconfig.json'])
  } else {
    throw new Error('build: cannot locate the dsh checkout (set DSH_CHECKOUT)')
  }
} else {
  const links = {
    cordis: 'vendor/cordis',
    cosmokit: 'vendor/cosmokit',
    schemastery: 'vendor/schemastery',
    '@deepseek-ai/cordis': 'vendor/cordis',
    '@deepseek-ai/cosmokit': 'vendor/cosmokit',
    '@deepseek-ai/schemastery': 'vendor/schemastery',
    '@deepseek-ai/dsh-tools': 'packages/core/tools',
    '@deepseek-ai/dsh-llm': 'packages/llm/llm',
    '@deepseek-ai/dsh-system-prompt': 'packages/core/system-prompt',
    '@deepseek-ai/dsh-skill': 'packages/skill/skill',
    '@deepseek-ai/dsh-settings': 'packages/settings/settings',
    '@deepseek-ai/dsh-host-webserver': 'packages/host/webserver',
    '@deepseek-ai/dsh-scope': 'packages/core/scope',
    '@deepseek-ai/dsh-invariants': 'packages/runtime-diagnostics/invariants',
    '@deepseek-ai/dsh-brand': 'packages/util/brand',
    '@deepseek-ai/dsh-client-locale': 'packages/client/locale',
    '@deepseek-ai/dsh-client-runtime': 'packages/client/runtime',
    '@deepseek-ai/dsh-client-ui-primitives': 'packages/client/ui-primitives',
    '@deepseek-ai/dsh-client-ui-settings': 'packages/client/ui-settings',
    '@deepseek-ai/dsh-client-ui-slots': 'packages/client/ui-slots',
    '@deepseek-ai/dsh-client-web-react': 'packages/client/web-react',
  }
  for (const [name, relativePath] of Object.entries(links)) linkPackage(checkout, name, relativePath)

  const nodeTypes = join(root, 'node_modules', '@types', 'node')
  const checkoutNodeTypes = join(checkout, 'node_modules', '@types', 'node')
  if (existsSync(checkoutNodeTypes)) {
    rmSync(nodeTypes, { recursive: true, force: true })
    mkdirSync(dirname(nodeTypes), { recursive: true })
    symlinkSync(checkoutNodeTypes, nodeTypes, process.platform === 'win32' ? 'junction' : 'dir')
  }

  const pnpmDir = join(checkout, 'node_modules', '.pnpm')
  const schemaDir = existsSync(pnpmDir)
    ? readdirSync(pnpmDir).find(name => name.toLowerCase().startsWith('@standard-schema+spec@'))
    : undefined
  if (schemaDir !== undefined) {
    const schemaTarget = join(pnpmDir, schemaDir, 'node_modules', '@standard-schema', 'spec')
    const schemaLink = join(root, 'node_modules', '@standard-schema', 'spec')
    if (existsSync(schemaTarget)) {
      rmSync(schemaLink, { recursive: true, force: true })
      mkdirSync(dirname(schemaLink), { recursive: true })
      symlinkSync(schemaTarget, schemaLink, process.platform === 'win32' ? 'junction' : 'dir')
    }
  }
  run(existsSync(join(checkout, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc'))
    ? join(checkout, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc')
    : localTsc, ['-p', 'tsconfig.json'])
}
