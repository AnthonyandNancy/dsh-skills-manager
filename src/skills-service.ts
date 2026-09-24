/**
 * Management service over DSH's native Skills system.
 *
 * This service is deliberately thin: it reads through `ctx.skills` (the native
 * registry) and writes through DSH's managed skills directories. It does not
 * implement a registry, loader, cache, watcher, or runtime.
 */

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import type { ManagedSkillDetail, ManagedSkillRow } from './types.ts'
import { createSkillAccess } from './skills-access.ts'
import { withSkillsManagerView, withViewScope } from './skills-view.ts'
import { resolveDshSkillsRoot } from './import/importer.ts'
import { serializeSkillFile } from './import/parser.ts'

/** Kebab-case skill name grammar, matching DSH's native Skill name rule. */
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
function isSkillName(name: string): boolean {
  return SKILL_NAME.test(name)
}

export interface ManagedSkillContext {
  /** DSH context; the skills service is fetched via `ctx.get('skills')`. */
  readonly ctx: {
    get?: (name: string) => any
    skills?: any
    logger?: { info?: (...args: any[]) => void; warn?: (...args: any[]) => void; error?: (...args: any[]) => void }
  }
  readonly dshHome?: string
}

async function nativeSkills(ctx: ManagedSkillContext): Promise<any> {
  return await createSkillAccess(ctx.ctx)
}

/** Resolve the DSH-managed roots that this plugin is allowed to write/delete. */
export function managedSkillRoots(ctx: ManagedSkillContext, cwd?: string): string[] {
  const roots = [
    resolveDshSkillsRoot(ctx.dshHome),
    join(process.env.DSH_AGENTS_HOME ?? join(homedir(), '.agents'), 'skills'),
  ]
  if (cwd !== undefined && cwd.length > 0) {
    roots.push(join(cwd, '.dsh', 'skills'))
    roots.push(join(cwd, '.agents', 'skills'))
  }
  return roots
}

function isInside(root: string, target: string): boolean {
  const rel = relative(root, target)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

/** Verify a path is inside one of DSH's managed skill roots. */
export function assertManagedSkillPath(path: string, roots: readonly string[]): void {
  const resolved = resolve(path)
  for (const root of roots) {
    if (isInside(resolve(root), resolved)) return
  }
  throw new Error(`refusing to modify "${path}": not inside DSH managed skill roots`)
}

/** List DSH native skills with management metadata. */
export async function listManagedSkills(ctx: ManagedSkillContext, cwd?: string): Promise<ManagedSkillRow[]> {
  return await withSkillsManagerView(ctx.ctx, async (view) => {
    const summaries = await view.registry.list(withViewScope(view, { cwd }))
    ctx.ctx.logger?.info?.(
      '[dsh-skills-manager] skills.list: cwd=%s scopeSource=%s registry=host count=%d',
      cwd ?? '-',
      view.scopeSource,
      summaries.length,
    )
    const rows: ManagedSkillRow[] = []
    for (const summary of summaries) {
      let path: string | undefined
      try {
        path = (await view.registry.get(summary.name, withViewScope(view, { cwd })))?.path
      } catch {
        path = undefined
      }
      rows.push({
        name: summary.name,
        description: summary.description,
        ...summary.whenToUse === undefined ? {} : { whenToUse: summary.whenToUse },
        source: summary.source,
        provider: summary.provider,
        ...path === undefined ? {} : { path },
        modelInvocable: summary.invocation.modelInvocable,
        userInvocable: summary.invocation.userInvocable,
      })
    }
    return rows
  })
}

/** Read one DSH native skill including its body. */
export async function getManagedSkill(
  ctx: ManagedSkillContext,
  name: string,
  cwd?: string,
): Promise<ManagedSkillDetail> {
  const skills = await nativeSkills(ctx)
  const definition = await skills.get(name, { cwd })
  if (definition === undefined) throw new Error(`skill "${name}" not found`)
  return {
    name: definition.name,
    description: definition.description,
    ...definition.whenToUse === undefined ? {} : { whenToUse: definition.whenToUse },
    source: definition.source,
    provider: definition.provider,
    ...definition.path === undefined ? {} : { path: definition.path },
    modelInvocable: definition.invocation.modelInvocable,
    userInvocable: definition.invocation.userInvocable,
    content: definition.content,
    ...definition.resourceBase === undefined ? {} : { resourceBase: definition.resourceBase },
  }
}

/** Create a new DSH skill in the user/global managed root. */
export async function createManagedSkill(
  ctx: ManagedSkillContext,
  input: { name: string; description: string; whenToUse?: string; body: string },
): Promise<ManagedSkillDetail> {
  const name = input.name.trim()
  if (!isSkillName(name)) throw new Error(`invalid kebab-case skill name "${name}"`)
  if (input.description.trim().length === 0) throw new Error('description is required')
  const root = resolveDshSkillsRoot(ctx.dshHome)
  await mkdir(root, { recursive: true })
  const targetDir = join(root, name)
  const targetFile = join(targetDir, 'SKILL.md')
  await mkdir(targetDir, { recursive: true })
  const content = serializeSkillFile({ name, description: input.description.trim(), ...input.whenToUse === undefined ? {} : { whenToUse: input.whenToUse.trim() }, body: input.body })
  await writeFile(targetFile, content, 'utf8')
  return {
    name,
    description: input.description.trim(),
    ...input.whenToUse === undefined ? {} : { whenToUse: input.whenToUse.trim() },
    source: 'user-dsh',
    provider: 'filesystem',
    path: targetFile,
    modelInvocable: true,
    userInvocable: true,
    content,
  }
}

/** Update an existing DSH skill through its managed filesystem location. */
export async function updateManagedSkill(
  ctx: ManagedSkillContext,
  input: { name: string; description: string; whenToUse?: string; body: string },
  cwd?: string,
): Promise<ManagedSkillDetail> {
  const skills = await nativeSkills(ctx)
  const definition = await skills.get(input.name, { cwd })
  if (definition === undefined) throw new Error(`skill "${input.name}" not found`)
  if (definition.path === undefined) throw new Error(`skill "${input.name}" is not filesystem-backed and cannot be edited`)
  const roots = managedSkillRoots(ctx, cwd)
  assertManagedSkillPath(definition.path, roots)

  const targetFile = definition.path.endsWith('SKILL.md') ? definition.path : definition.path
  const content = serializeSkillFile({
    name: input.name,
    description: input.description.trim(),
    ...input.whenToUse === undefined ? {} : { whenToUse: input.whenToUse.trim() },
    body: input.body,
  })
  await writeFile(targetFile, content, 'utf8')
  return {
    ...(await getManagedSkill(ctx, input.name, cwd)),
    content,
  }
}

/** Delete a DSH-managed skill. External source files are never touched. */
export async function deleteManagedSkill(
  ctx: ManagedSkillContext,
  name: string,
  cwd?: string,
): Promise<void> {
  const skills = await nativeSkills(ctx)
  const definition = await skills.get(name, { cwd })
  if (definition === undefined) throw new Error(`skill "${name}" not found`)
  if (definition.path === undefined) throw new Error(`skill "${name}" is not filesystem-backed and cannot be deleted`)
  const roots = managedSkillRoots(ctx, cwd)
  assertManagedSkillPath(definition.path, roots)
  const target = definition.path.endsWith('SKILL.md') ? dirname(definition.path) : definition.path
  await rm(target, { recursive: true, force: true })
}

/** Read the raw SKILL.md content from a managed skill path. */
export async function readSkillFile(path: string): Promise<string> {
  return await readFile(path, 'utf8')
}
