import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  listManagedSkills: vi.fn(),
  getManagedSkill: vi.fn(),
  createManagedSkill: vi.fn(),
  updateManagedSkill: vi.fn(),
  deleteManagedSkill: vi.fn(),
}))

vi.mock('../src/skills-service.ts', () => mocks)

import { API_PATH, installRoutes } from '../src/routes.ts'
import type { MetadataStore } from '../src/storage.ts'

interface RegisteredRoute {
  path: string
  methods: string[]
  requestBody: string
  fetch: (request: Request) => Promise<Response>
}

const metadata = {
  ready: async () => {},
  get: () => ({ version: 2, externalImportCompleted: false }),
  save: async () => {},
} as unknown as MetadataStore

/** Host context whose `inject(['connection'], …)` hands back a Fetch registry. */
function hostWithConnection(register = vi.fn((_route: RegisteredRoute) => () => Promise.resolve())) {
  const warn = vi.fn()
  const info = vi.fn()
  const connectionCtx = {
    connection: { fetch: { register } },
    logger: { warn, info },
    effect: (callback: () => unknown) => {
      const dispose = callback()
      return () => { if (typeof dispose === 'function') (dispose as () => void)() }
    },
  }
  const ctx = {
    inject: (names: string[], callback: (ctx: unknown) => void) => {
      if (names.includes('connection')) callback(connectionCtx)
    },
    get: () => undefined,
    logger: { warn, info },
  }
  return { ctx, register, warn }
}

function post(payload: unknown, contentType = 'application/json'): Request {
  return new Request(`http://dsh.internal${API_PATH}`, {
    method: 'POST',
    headers: { 'content-type': contentType },
    body: typeof payload === 'string' ? payload : JSON.stringify(payload),
  })
}

describe('Skills Manager host API on the /api Fetch registry', () => {
  it('claims one POST route under /api and dispatches the method from the body', async () => {
    mocks.listManagedSkills.mockResolvedValue([{ name: 'alpha' }])
    const { ctx, register } = hostWithConnection()
    installRoutes({ ctx: ctx as never, metadata, dshHome: '/tmp/dsh' })

    expect(register).toHaveBeenCalledTimes(1)
    const route = register.mock.calls[0]?.[0] as RegisteredRoute
    expect(route.path).toBe('/api/skills-manager')
    expect(route.methods).toEqual(['POST'])
    expect(route.requestBody).toBe('buffered')

    const response = await route.fetch(post({ method: 'skills.list', cwd: 'C:/ws' }))
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual({ ok: true, value: { skills: [{ name: 'alpha' }] } })
    expect(mocks.listManagedSkills).toHaveBeenCalledWith(expect.objectContaining({ dshHome: '/tmp/dsh' }), 'C:/ws')
  })

  it('rejects a missing selector, a non-JSON body, and an unknown method', async () => {
    const { ctx, register } = hostWithConnection()
    installRoutes({ ctx: ctx as never, metadata })
    const route = register.mock.calls[0]?.[0] as RegisteredRoute

    const missing = await route.fetch(post({}))
    expect(missing.status).toBe(400)
    await expect(missing.json()).resolves.toMatchObject({ ok: false, error: { code: 'bad-request' } })

    const wrongType = await route.fetch(post({ method: 'skills.list' }, 'text/plain'))
    expect(wrongType.status).toBe(400)
    await expect(wrongType.json()).resolves.toMatchObject({ ok: false, error: { code: 'bad-request' } })

    const malformed = await route.fetch(post('{not json'))
    expect(malformed.status).toBe(400)

    const unknown = await route.fetch(post({ method: 'skills.nope' }))
    expect(unknown.status).toBe(404)
    await expect(unknown.json()).resolves.toMatchObject({ ok: false, error: { code: 'not-found' } })
  })

  it('stays inert with a warning on a release without the connection Fetch registry', () => {
    const { ctx, warn } = hostWithConnection()
    const connectionCtx = { connection: {}, logger: { warn }, effect: (callback: () => unknown) => callback() }
    ;(ctx as { inject: (names: string[], callback: (ctx: unknown) => void) => void }).inject = (names, callback) => {
      if (names.includes('connection')) callback(connectionCtx)
    }

    expect(() => { installRoutes({ ctx: ctx as never, metadata }) }).not.toThrow()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no connection Fetch registry'))
  })
})
