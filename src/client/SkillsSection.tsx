/**
 * Settings → Skills section.
 *
 * This UI is a viewer/editor over DSH's native Skills API. It never keeps a
 * second skill store: every mutation goes through the host API, which reads
 * `ctx.skills` and writes DSH-managed skill directories.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactElement } from 'react'
import type {
  ConflictView,
  ImportReport,
  ManagedSkillDetail,
  ManagedSkillRow,
  SkillsManagerApi,
} from './api.ts'

export interface SkillsSectionInjected {
  api: SkillsManagerApi
  remote?: {
    $on?: (event: string, listener: () => void) => () => void
  }
}

export type SkillsSectionProps = Partial<SkillsSectionInjected>

type Mode = 'list' | 'detail' | 'create' | 'edit' | 'import' | 'conflicts'

interface EditorDraft {
  name: string
  description: string
  whenToUse: string
  body: string
  scope: 'global' | 'project'
}

const EMPTY_DRAFT: EditorDraft = { name: '', description: '', whenToUse: '', body: '', scope: 'global' }

const styles: Record<string, CSSProperties> = {
  root: { padding: '16px', maxWidth: '960px' },
  header: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' },
  title: { margin: 0, fontSize: '18px', fontWeight: 600, flex: '1 1 auto' },
  search: { padding: '6px 10px', borderRadius: '6px', border: '1px solid #ccc', minWidth: '220px' },
  button: { padding: '6px 12px', borderRadius: '6px', border: '1px solid #ccc', background: '#f5f5f5', cursor: 'pointer' },
  primaryButton: { padding: '6px 12px', borderRadius: '6px', border: '1px solid #2563eb', background: '#2563eb', color: '#fff', cursor: 'pointer' },
  dangerButton: { padding: '6px 12px', borderRadius: '6px', border: '1px solid #dc2626', background: '#dc2626', color: '#fff', cursor: 'pointer' },
  panel: { border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px', marginBottom: '12px', background: '#fafafa' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
  th: { textAlign: 'left', padding: '8px', borderBottom: '1px solid #e5e7eb' },
  td: { padding: '8px', borderBottom: '1px solid #f3f4f6', verticalAlign: 'top' },
  rowButton: { marginRight: '6px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: '13px' },
  error: { color: '#b91c1c', padding: '8px', background: '#fee2e2', borderRadius: '6px', marginBottom: '8px' },
  info: { color: '#1f2937', padding: '8px', background: '#e5e7eb', borderRadius: '6px', marginBottom: '8px' },
  form: { display: 'grid', gap: '10px', marginTop: '8px' },
  label: { fontWeight: 500 },
  input: { padding: '6px 8px', borderRadius: '6px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box' },
  textarea: { padding: '6px 8px', borderRadius: '6px', border: '1px solid #ccc', width: '100%', minHeight: '120px', boxSizing: 'border-box', fontFamily: 'monospace' },
  pre: { background: '#0f172a', color: '#e2e8f0', padding: '12px', borderRadius: '8px', overflow: 'auto', maxHeight: '400px', fontSize: '13px' },
  modalBackdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  modal: { background: '#fff', borderRadius: '10px', padding: '16px', width: 'min(640px, 90vw)', maxHeight: '85vh', overflow: 'auto' },
  summary: { display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '8px' },
  summaryItem: { display: 'grid', gap: '2px' },
  summaryNumber: { fontSize: '20px', fontWeight: 700 },
  summaryLabel: { fontSize: '12px', color: '#6b7280' },
  list: { margin: 0, paddingLeft: '18px', fontSize: '13px' },
}

export function SkillsSection(props: SkillsSectionProps): ReactElement {
  const api = props.api!
  const remote = props.remote

  const [skills, setSkills] = useState<ManagedSkillRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | undefined>()
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState<Mode>('list')
  const [selected, setSelected] = useState<ManagedSkillDetail | undefined>()
  const [draft, setDraft] = useState<EditorDraft>(EMPTY_DRAFT)
  const [report, setReport] = useState<ImportReport | undefined>()
  const [conflicts, setConflicts] = useState<ConflictView[]>([])
  const [deleteTarget, setDeleteTarget] = useState<ManagedSkillRow | undefined>()
  const [busy, setBusy] = useState(false)

  const loadSkills = useCallback(async () => {
    try {
      const result = await api.listSkills()
      setSkills(result.skills)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [api])

  const loadMeta = useCallback(async () => {
    try {
      const result = await api.importMeta()
      setReport(result.report)
    } catch {
      // Meta is optional; the table is the primary surface.
    }
  }, [api])

  const loadConflicts = useCallback(async () => {
    try {
      const result = await api.listConflicts()
      setConflicts(result.conflicts)
    } catch {
      setConflicts([])
    }
  }, [api])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(undefined)
    await Promise.all([loadSkills(), loadMeta(), loadConflicts()])
    setLoading(false)
  }, [loadSkills, loadMeta, loadConflicts])

  useEffect(() => { void refresh() }, [refresh])

  useEffect(() => {
    if (remote?.$on === undefined) return
    const disposers = [
      remote.$on('skills/change', () => { void refresh() }),
    ]
    return () => { for (const dispose of disposers) dispose() }
  }, [remote, refresh])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (q.length === 0) return skills
    return skills.filter(skill =>
      skill.name.toLowerCase().includes(q) || skill.description.toLowerCase().includes(q),
    )
  }, [skills, search])

  const openDetail = useCallback(async (skill: ManagedSkillRow) => {
    try {
      const result = await api.getSkill(skill.name)
      setSelected(result.skill)
      setMode('detail')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [api])

  const openEdit = useCallback(async (skill: ManagedSkillRow) => {
    try {
      const result = await api.getSkill(skill.name)
      setSelected(result.skill)
      setDraft({
        name: result.skill.name,
        description: result.skill.description,
        whenToUse: result.skill.whenToUse ?? '',
        body: result.skill.content,
        scope: 'global',
      })
      setMode('edit')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [api])

  const openCreate = useCallback(() => {
    setDraft(EMPTY_DRAFT)
    setMode('create')
  }, [])

  const save = useCallback(async () => {
    setBusy(true)
    setError(undefined)
    try {
      if (mode === 'create') {
        await api.createSkill({
          name: draft.name,
          description: draft.description,
          whenToUse: draft.whenToUse,
          body: draft.body,
          scope: draft.scope,
        })
      } else if (mode === 'edit' && selected !== undefined) {
        await api.updateSkill({
          name: selected.name,
          description: draft.description,
          whenToUse: draft.whenToUse,
          body: draft.body,
        })
      }
      setMode('list')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }, [api, mode, draft, selected, refresh])

  const confirmDelete = useCallback(async () => {
    if (deleteTarget === undefined) return
    setBusy(true)
    setError(undefined)
    try {
      await api.deleteSkill(deleteTarget.name)
      setDeleteTarget(undefined)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }, [api, deleteTarget, refresh])

  const scan = useCallback(async () => {
    setBusy(true)
    setError(undefined)
    try {
      const result = await api.scanExternal()
      setReport(result.report)
      setMode('import')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }, [api, refresh])

  const resolve = useCallback(async (conflict: ConflictView, source: string) => {
    setBusy(true)
    setError(undefined)
    try {
      await api.resolveConflict(conflict.name, source)
      await refresh()
      setMode('conflicts')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }, [api, refresh])

  if (mode === 'detail' && selected !== undefined) {
    return (
      <div style={styles.root}>
        <div style={styles.header}>
          <h2 style={styles.title}>{selected.name}</h2>
          <button style={styles.button} onClick={() => setMode('list')}>Back</button>
          <button style={styles.primaryButton} onClick={() => openEdit(selected)}>Edit</button>
        </div>
        {error !== undefined ? <div style={styles.error}>{error}</div> : null}
        <div style={styles.panel}>
          <p><strong>Description:</strong> {selected.description}</p>
          {selected.whenToUse !== undefined ? <p><strong>When to use:</strong> {selected.whenToUse}</p> : null}
          <p><strong>Source:</strong> {selected.source} · <strong>Provider:</strong> {selected.provider}</p>
          {selected.path !== undefined ? <p><strong>Location:</strong> <code>{selected.path}</code></p> : null}
          <p><strong>Model invocable:</strong> {selected.modelInvocable ? 'yes' : 'no'} · <strong>User invocable:</strong> {selected.userInvocable ? 'yes' : 'no'}</p>
          <pre style={styles.pre}>{selected.content}</pre>
        </div>
      </div>
    )
  }

  if (mode === 'create' || mode === 'edit') {
    return (
      <div style={styles.root}>
        <div style={styles.header}>
          <h2 style={styles.title}>{mode === 'create' ? 'New Skill' : `Edit ${selected?.name ?? ''}`}</h2>
          <button style={styles.button} onClick={() => setMode('list')}>Cancel</button>
          <button style={styles.primaryButton} disabled={busy} onClick={save}>Save</button>
        </div>
        {error !== undefined ? <div style={styles.error}>{error}</div> : null}
        <div style={styles.form}>
          <label style={styles.label}>
            Name
            <input
              style={styles.input}
              value={draft.name}
              disabled={mode === 'edit'}
              onChange={event => setDraft({ ...draft, name: event.target.value })}
              placeholder="kebab-case-skill-name"
            />
          </label>
          {mode === 'create' ? (
            <label style={styles.label}>
              Scope
              <select
                style={styles.input}
                value={draft.scope}
                onChange={event => setDraft({ ...draft, scope: event.target.value as 'global' | 'project' })}
              >
                <option value="global">Global</option>
                <option value="project">Project</option>
              </select>
            </label>
          ) : null}
          <label style={styles.label}>
            Description
            <textarea
              style={styles.textarea}
              value={draft.description}
              onChange={event => setDraft({ ...draft, description: event.target.value })}
            />
          </label>
          <label style={styles.label}>
            When to use (optional)
            <input
              style={styles.input}
              value={draft.whenToUse}
              onChange={event => setDraft({ ...draft, whenToUse: event.target.value })}
            />
          </label>
          <label style={styles.label}>
            SKILL.md body
            <textarea
              style={{ ...styles.textarea, minHeight: '220px' }}
              value={draft.body}
              onChange={event => setDraft({ ...draft, body: event.target.value })}
            />
          </label>
        </div>
      </div>
    )
  }

  if (mode === 'import' && report !== undefined) {
    return (
      <div style={styles.root}>
        <div style={styles.header}>
          <h2 style={styles.title}>External Skills Import</h2>
          <button style={styles.button} onClick={() => setMode('list')}>Back</button>
          <button style={styles.primaryButton} disabled={busy} onClick={scan}>Scan Again</button>
        </div>
        {error !== undefined ? <div style={styles.error}>{error}</div> : null}
        <ImportReportView report={report} />
      </div>
    )
  }

  if (mode === 'conflicts') {
    return (
      <div style={styles.root}>
        <div style={styles.header}>
          <h2 style={styles.title}>Import Conflicts</h2>
          <button style={styles.button} onClick={() => setMode('list')}>Back</button>
        </div>
        {error !== undefined ? <div style={styles.error}>{error}</div> : null}
        {conflicts.length === 0 ? <div style={styles.info}>No pending conflicts.</div> : (
          <div style={styles.panel}>
            {conflicts.map(conflict => (
              <div key={conflict.name} style={{ marginBottom: '16px', borderBottom: '1px solid #e5e7eb', paddingBottom: '12px' }}>
                <strong>{conflict.name}</strong>
                <p style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0' }}>{conflict.reason}</p>
                {conflict.existing !== undefined ? <p style={{ fontSize: '13px' }}>DSH existing: {conflict.existing.path ?? conflict.existing.name}</p> : null}
                {conflict.candidates.map(candidate => (
                  <button
                    key={candidate.source}
                    style={{ ...styles.rowButton, marginTop: '6px' }}
                    disabled={busy}
                    onClick={() => resolve(conflict, candidate.source)}
                  >
                    Use {candidate.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <h2 style={styles.title}>Skills</h2>
        <input
          style={styles.search}
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Search skills..."
        />
        <button style={styles.button} disabled={busy} onClick={() => setMode('conflicts')}>
          Conflicts ({conflicts.length})
        </button>
        <button style={styles.button} disabled={busy} onClick={scan}>Scan External Skills</button>
        <button style={styles.primaryButton} onClick={openCreate}>New Skill</button>
      </div>

      {error !== undefined ? <div style={styles.error}>{error}</div> : null}
      {loading ? <div style={styles.info}>Loading skills…</div> : null}

      {report !== undefined ? (
        <div style={styles.panel}>
          <div style={styles.summary}>
            <SummaryItem label="Scanned" value={report.scanned} />
            <SummaryItem label="Imported" value={report.imported} />
            <SummaryItem label="Duplicates" value={report.duplicates} />
            <SummaryItem label="Conflicts" value={report.conflicts} />
            <SummaryItem label="Invalid" value={report.invalid} />
          </div>
          <button style={styles.rowButton} onClick={() => setMode('import')}>View Details</button>
        </div>
      ) : null}

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Name</th>
            <th style={styles.th}>Description</th>
            <th style={styles.th}>Scope</th>
            <th style={styles.th}>Location</th>
            <th style={styles.th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(skill => (
            <tr key={skill.name}>
              <td style={styles.td}><code>{skill.name}</code></td>
              <td style={styles.td}>{skill.description}</td>
              <td style={styles.td}>{skill.source}</td>
              <td style={styles.td}><code style={{ fontSize: '12px' }}>{skill.path ?? ''}</code></td>
              <td style={styles.td}>
                <button style={styles.rowButton} onClick={() => openDetail(skill)}>View</button>
                <button style={styles.rowButton} onClick={() => openEdit(skill)}>Edit</button>
                <button style={{ ...styles.rowButton, color: '#b91c1c' }} onClick={() => setDeleteTarget(skill)}>Delete</button>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && !loading ? (
            <tr><td colSpan={5} style={styles.td}>No skills found.</td></tr>
          ) : null}
        </tbody>
      </table>

      {deleteTarget !== undefined ? (
        <div style={styles.modalBackdrop}>
          <div style={styles.modal}>
            <h3>Delete "{deleteTarget.name}"?</h3>
            <p>This action cannot be undone. Only the DSH-managed skill will be removed; external source files are never touched.</p>
            {error !== undefined ? <div style={styles.error}>{error}</div> : null}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button style={styles.button} disabled={busy} onClick={() => setDeleteTarget(undefined)}>Cancel</button>
              <button style={styles.dangerButton} disabled={busy} onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function SummaryItem({ label, value }: { label: string; value: number }): ReactElement {
  return (
    <div style={styles.summaryItem}>
      <span style={styles.summaryNumber}>{value}</span>
      <span style={styles.summaryLabel}>{label}</span>
    </div>
  )
}

function ImportReportView({ report }: { report: ImportReport }): ReactElement {
  const [filter, setFilter] = useState<string>('all')
  const items = report.items.filter(item => filter === 'all' || item.result === filter)
  const filters = ['all', 'new', 'duplicate', 'conflict', 'invalid', 'skipped'] as const
  return (
    <div style={styles.panel}>
      <div style={styles.summary}>
        <SummaryItem label="Scanned" value={report.scanned} />
        <SummaryItem label="Imported" value={report.imported} />
        <SummaryItem label="Duplicates" value={report.duplicates} />
        <SummaryItem label="Conflicts" value={report.conflicts} />
        <SummaryItem label="Invalid" value={report.invalid} />
      </div>
      <div style={{ margin: '8px 0', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {filters.map(name => (
          <button
            key={name}
            style={{ ...styles.rowButton, ...(filter === name ? { background: '#e0e7ff' } : {}) }}
            onClick={() => setFilter(name)}
          >
            {name}
          </button>
        ))}
      </div>
      {items.length === 0 ? <p>No items.</p> : (
        <ul style={styles.list}>
          {items.map((item, index) => (
            <li key={`${item.source}-${item.skill}-${index}`} style={{ marginBottom: '4px' }}>
              <code>{item.skill}</code> ({item.source}) — <strong>{item.result}</strong> — {item.reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
