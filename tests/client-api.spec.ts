import { afterEach, describe, expect, it, vi } from 'vitest'
import { API_PATH, SkillsApiError, skillsManagerApi } from '../src/client/api.ts'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function stubFetch(implementation: (input: unknown, init: RequestInit) => Promise<Response>) {
  const stub = vi.fn(implementation)
  vi.stubGlobal('fetch', stub)
  return stub
}

afterEach(() => { vi.unstubAllGlobals() })

describe('Skills Manager client transport', () => {
  it('posts every method to the single fenced /api route with the selector in the body', async () => {
    const fetchStub = stubFetch(async () => jsonResponse({ ok: true, value: { skills: [] } }))

    await skillsManagerApi.listSkills('C:/workspace')
    await skillsManagerApi.skillsDirectory()

    expect(API_PATH).toBe('/api/skills-manager')
    expect(fetchStub).toHaveBeenCalledTimes(2)
    const [url, init] = fetchStub.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(API_PATH)
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'content-type': 'application/json' })
    expect(JSON.parse(String(init.body))).toEqual({ method: 'skills.list', cwd: 'C:/workspace' })
    expect(JSON.parse(String(fetchStub.mock.calls[1]?.[1]?.body))).toEqual({ method: 'skills.directory' })
  })

  it('unwraps the ok envelope and forwards the host error envelope', async () => {
    stubFetch(async () => jsonResponse({ ok: true, value: { skills: [{ name: 'alpha' }] } }))
    await expect(skillsManagerApi.listSkills()).resolves.toEqual({ skills: [{ name: 'alpha' }] })

    stubFetch(async () => jsonResponse({ ok: false, error: { code: 'skills-manager-error', message: 'nope' } }, 400))
    const failure = await skillsManagerApi.listSkills().catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(SkillsApiError)
    expect((failure as SkillsApiError).code).toBe('skills-manager-error')
    expect((failure as SkillsApiError).message).toBe('nope')
  })

  it('reports a rejected fetch as a network failure and a non-JSON body as a bad response', async () => {
    stubFetch(async () => { throw new TypeError('Failed to fetch') })
    const network = await skillsManagerApi.listSkills().catch((error: unknown) => error)
    expect((network as SkillsApiError).code).toBe('network')
    expect((network as SkillsApiError).message).toBe('Failed to fetch')

    stubFetch(async () => new Response('not json', { status: 405 }))
    const badResponse = await skillsManagerApi.listSkills().catch((error: unknown) => error)
    expect((badResponse as SkillsApiError).code).toBe('bad-response')
    expect((badResponse as SkillsApiError).message).toContain('405')
  })
})
