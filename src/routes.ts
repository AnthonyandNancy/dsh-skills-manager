/**
 * Skills Manager JSON API (web profile).
 *
 * This is the thin management API used by the Settings → Skills UI. It calls
 * DSH's native Skills registry and DSH-managed skill directories; it never
 * reimplements skill runtime behavior.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { MetadataStore } from './storage.ts'
import { listManagedSkills, getManagedSkill, createManagedSkill, updateManagedSkill, deleteManagedSkill } from './skills-service.ts'
import { runExternalImport, reportFromMetadata } from './import/importer.ts'
import { listConflicts, resolveConflict } from './import/resolver.ts'
import type { ExternalSourceId, ManagedSkillRow } from './types.ts'

export const API_PREFIX = '/skills-manager/api/'

interface RouteServices {
  readonly ctx: any
  readonly metadata: MetadataStore
  readonly dshHome?: string
}

type JsonResponse<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; message: string } }

function writeJson<T>(res: ServerResponse, status: number, body: JsonResponse<T>): void {
  const bytes = Buffer.from(JSON.stringify(body))
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Content-Length', String(bytes.length))
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.writeHead(status)
  res.end(bytes)
}

function error(res: ServerResponse, status: number, code: string, message: string): void {
  writeJson(res, status, { ok: false, error: { code, message } })
}

function ok<T>(res: ServerResponse, value: T): void {
  writeJson(res, 200, { ok: true, value })
}

/** Accept state-changing requests only from the DSH Web application's origin. */
function sameOriginPost(req: IncomingMessage): boolean {
  const fetchSite = req.headers['sec-fetch-site']
  if (fetchSite === 'cross-site') return false
  const origin = req.headers.origin
  if (origin === undefined) return fetchSite === 'same-origin' || fetchSite === 'same-site' || fetchSite === 'none'
  const host = req.headers.host
  if (host === undefined) return false
  try {
    const parsed = new URL(origin)
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.host === host
  } catch {
    return false
  }
}

async function readJson(req: IncomingMessage, maxBytes = 256 * 1024): Promise<unknown> {
  const contentType = req.headers['content-type']?.split(';', 1)[0]?.trim().toLowerCase()
  if (contentType !== 'application/json') throw new TypeError('Content-Type must be application/json')
  const chunks: Buffer[] = []
  let bytes = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    bytes += buffer.length
    if (bytes > maxBytes) throw new TypeError('request body too large')
    chunks.push(buffer)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  return text.length === 0 ? {} : JSON.parse(text)
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function resolveCwd(ctx: any, payload: Record<string, unknown>): string | undefined {
  const explicit = stringField(payload.cwd)
  if (explicit !== undefined && explicit.length > 0) return explicit
  try {
    const sessions = ctx.get?.('sessions')
    const first = sessions?.list?.()?.[0]
    return first?.header?.cwd
  } catch {
    return undefined
  }
}

async function handle(services: RouteServices, req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    error(res, 405, 'method-not-allowed', 'POST required')
    return
  }
  if (!sameOriginPost(req)) {
    error(res, 403, 'forbidden', 'cross-origin request rejected')
    return
  }

  let payload: Record<string, unknown>
  try {
    const raw = await readJson(req)
    payload = asRecord(raw)
  } catch (err) {
    error(res, 400, 'bad-request', err instanceof Error ? err.message : String(err))
    return
  }

  const url = new URL(req.url ?? '/', 'http://localhost')
  if (!url.pathname.startsWith(API_PREFIX)) {
    error(res, 404, 'not-found', 'unknown skills-manager API method')
    return
  }
  const method = url.pathname.slice(API_PREFIX.length)

  try {
    switch (method) {
      case 'skills.list': {
        const cwd = resolveCwd(services.ctx, payload)
        const skills = await listManagedSkills({ ctx: services.ctx, dshHome: services.dshHome }, cwd)
        ok(res, { skills })
        return
      }
      case 'skills.get': {
        const name = stringField(payload.name)
        if (name === undefined) throw new Error('name is required')
        const cwd = resolveCwd(services.ctx, payload)
        const skill = await getManagedSkill({ ctx: services.ctx, dshHome: services.dshHome }, name, cwd)
        ok(res, { skill })
        return
      }
      case 'skills.create': {
        const name = stringField(payload.name)
        const description = stringField(payload.description)
        const body = stringField(payload.body)
        const whenToUse = stringField(payload.whenToUse)
        if (name === undefined || description === undefined || body === undefined) {
          throw new Error('name, description and body are required')
        }
        const scope = stringField(payload.scope) ?? 'global'
        const cwd = scope === 'project' ? resolveCwd(services.ctx, payload) : undefined
        if (scope === 'project' && cwd === undefined) throw new Error('project scope requires a cwd')
        const skill = await createManagedSkill(
          { ctx: services.ctx, dshHome: services.dshHome },
          { name, description, ...whenToUse === undefined ? {} : { whenToUse }, body },
        )
        ok(res, { skill })
        return
      }
      case 'skills.update': {
        const name = stringField(payload.name)
        const description = stringField(payload.description)
        const body = stringField(payload.body)
        const whenToUse = stringField(payload.whenToUse)
        if (name === undefined || description === undefined || body === undefined) {
          throw new Error('name, description and body are required')
        }
        const cwd = resolveCwd(services.ctx, payload)
        const skill = await updateManagedSkill(
          { ctx: services.ctx, dshHome: services.dshHome },
          { name, description, ...whenToUse === undefined ? {} : { whenToUse }, body },
          cwd,
        )
        ok(res, { skill })
        return
      }
      case 'skills.delete': {
        const name = stringField(payload.name)
        if (name === undefined) throw new Error('name is required')
        const cwd = resolveCwd(services.ctx, payload)
        await deleteManagedSkill({ ctx: services.ctx, dshHome: services.dshHome }, name, cwd)
        ok(res, { deleted: name })
        return
      }
      case 'import.scan': {
        const cwd = resolveCwd(services.ctx, payload)
        const report = await runExternalImport(services, cwd)
        ok(res, { report })
        return
      }
      case 'import.meta': {
        const report = reportFromMetadata(services.metadata)
        ok(res, {
          externalImportCompleted: services.metadata.get().externalImportCompleted,
          lastScanAt: services.metadata.get().lastScanAt,
          ...report === undefined ? {} : { report },
        })
        return
      }
      case 'import.conflicts': {
        const cwd = resolveCwd(services.ctx, payload)
        const rows: ManagedSkillRow[] = await listManagedSkills({ ctx: services.ctx, dshHome: services.dshHome }, cwd)
        const conflicts = listConflicts(services.metadata, rows)
        ok(res, { conflicts })
        return
      }
      case 'import.resolve': {
        const name = stringField(payload.name)
        const source = stringField(payload.source) as ExternalSourceId | undefined
        if (name === undefined || source === undefined) throw new Error('name and source are required')
        const cwd = resolveCwd(services.ctx, payload)
        await resolveConflict({ ctx: services.ctx, dshHome: services.dshHome }, services.metadata, { name, source }, cwd)
        ok(res, { resolved: name })
        return
      }
      default:
        error(res, 404, 'not-found', `unknown method "${method}"`)
    }
  } catch (err) {
    error(res, 400, 'skills-manager-error', err instanceof Error ? err.message : String(err))
  }
}

/** Register the Skills Manager JSON API on DSH's web server (if present). */
export function installRoutes(services: RouteServices): void {
  const { ctx } = services
  ctx.inject(['webServer'], (webCtx: any) => {
    webCtx.effect(() => {
      const dispose = webCtx.webServer.register({
        kind: 'prefix',
        path: API_PREFIX.replace(/\/$/, ''),
        handler: (req: IncomingMessage, res: ServerResponse) => { void handle(services, req, res) },
      })
      return dispose
    }, 'dsh-skills-manager: routes')
  })
}
