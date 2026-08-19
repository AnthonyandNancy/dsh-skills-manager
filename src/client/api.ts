/**
 * Typed fetch wrapper over the Skills Manager host API.
 */

export interface ManagedSkillRow {
  name: string
  description: string
  whenToUse?: string
  source: string
  provider: string
  path?: string
  modelInvocable: boolean
  userInvocable: boolean
}

export interface ManagedSkillDetail extends ManagedSkillRow {
  content: string
  resourceBase?: unknown
}

export interface ImportReportItem {
  source: string
  skill: string
  path: string
  result: 'new' | 'duplicate' | 'conflict' | 'invalid' | 'skipped'
  reason: string
  fingerprint?: string
  importedSkillId?: string
  duplicateReason?: 'same-canonical-path' | 'same-external-fingerprint' | 'already-in-dsh'
  groupKey?: string
  importStatus?: 'not-needed' | 'imported' | 'failed'
}

export interface DuplicateBreakdown {
  samePath: number
  sameContent: number
  alreadyInDsh: number
}

export interface DuplicateGroup {
  key: string
  name: string
  fingerprint?: string
  inDsh: boolean
  sources: { source: string; path: string }[]
  candidateCount: number
  filteredCopies: number
  importedThisScan: boolean
}

/**
 * Import metrics. Candidate-copy metrics (`scannedCandidates`,
 * `duplicateCopies`, `invalid`) and unique-skill metrics (`uniqueValidSkills`,
 * `inDsh`, `importedThisScan`, `conflicts`) are different units and are not
 * expected to sum to `scannedCandidates`.
 */
export interface ImportReport {
  scannedCandidates: number
  uniqueValidSkills: number
  inDsh: number
  importedThisScan: number
  duplicateCopies: number
  conflicts: number
  invalid: number
  failed: number
  duplicateBreakdown: DuplicateBreakdown
  duplicateGroups: DuplicateGroup[]
  items: ImportReportItem[]
  startedAt: string
  finishedAt: string
}

export interface DshDuplicateAudit {
  scannedSkills: number
  duplicateContentGroups: {
    fingerprint: string
    skills: { name: string; path?: string; source: string; provider: string }[]
  }[]
  duplicateNameGroups: {
    name: string
    skills: { name: string; path?: string; source: string; provider: string; fingerprint?: string }[]
  }[]
  checkedAt: string
}

export interface ConflictCandidate {
  source: string
  label: string
  path: string
  fingerprint: string
  name: string
  description: string
}

export interface ConflictView {
  name: string
  existing?: ManagedSkillRow
  candidates: ConflictCandidate[]
  reason: string
}

export class SkillsApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

async function call<T>(method: string, payload: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/skills-manager/api/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    })
  } catch (error) {
    throw new SkillsApiError('network', error instanceof Error ? error.message : String(error))
  }
  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new SkillsApiError('bad-response', `server returned non-JSON (${response.status})`)
  }
  if (!response.ok || !isOk(body)) {
    const message = isError(body) ? body.error.message : `HTTP ${response.status}`
    const code = isError(body) ? body.error.code : 'http'
    throw new SkillsApiError(code, message)
  }
  return body.value as T
}

function isOk(value: unknown): value is { ok: true; value: unknown } {
  return typeof value === 'object' && value !== null && (value as { ok?: unknown }).ok === true
}

function isError(value: unknown): value is { ok: false; error: { code: string; message: string } } {
  return typeof value === 'object' && value !== null && (value as { ok?: unknown }).ok === false
}

export interface SkillsManagerApi {
  listSkills(cwd?: string): Promise<{ skills: ManagedSkillRow[] }>
  getSkill(name: string, cwd?: string): Promise<{ skill: ManagedSkillDetail }>
  createSkill(input: { name: string; description: string; whenToUse?: string; body: string; scope?: 'global' | 'project'; cwd?: string }): Promise<{ skill: ManagedSkillDetail }>
  updateSkill(input: { name: string; description: string; whenToUse?: string; body: string; cwd?: string }): Promise<{ skill: ManagedSkillDetail }>
  deleteSkill(name: string, cwd?: string): Promise<{ deleted: string }>
  scanExternal(cwd?: string): Promise<{ report: ImportReport }>
  importMeta(): Promise<{ externalImportCompleted: boolean; lastScanAt?: string; report?: ImportReport }>
  listConflicts(cwd?: string): Promise<{ conflicts: ConflictView[] }>
  resolveConflict(name: string, source: string, cwd?: string): Promise<{ resolved: string }>
  /** On-demand diagnostics; re-fingerprints native skills, so never automatic. */
  auditDuplicates(cwd?: string): Promise<{ audit: DshDuplicateAudit }>
}

export const skillsManagerApi: SkillsManagerApi = {
  listSkills(cwd) { return call('skills.list', cwd === undefined ? {} : { cwd }) },
  getSkill(name, cwd) { return call('skills.get', { name, ...cwd === undefined ? {} : { cwd } }) },
  createSkill(input) { return call('skills.create', input) },
  updateSkill(input) { return call('skills.update', input) },
  deleteSkill(name, cwd) { return call('skills.delete', { name, ...cwd === undefined ? {} : { cwd } }) },
  scanExternal(cwd) { return call('import.scan', cwd === undefined ? {} : { cwd }) },
  importMeta() { return call('import.meta', {}) },
  listConflicts(cwd) { return call('import.conflicts', cwd === undefined ? {} : { cwd }) },
  resolveConflict(name, source, cwd) { return call('import.resolve', { name, source, ...cwd === undefined ? {} : { cwd } }) },
  auditDuplicates(cwd) { return call('import.audit', cwd === undefined ? {} : { cwd }) },
}
