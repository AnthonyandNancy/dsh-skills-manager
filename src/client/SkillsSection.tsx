/**
 * Settings → Skills section.
 *
 * This UI is a viewer/editor over DSH's native Skills API. It never keeps a
 * second skill store: every mutation goes through the host API, which reads
 * `ctx.skills` and writes DSH-managed skill directories.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactElement } from 'react'
import { Button, Input, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  ConflictView,
  ImportReport,
  ManagedSkillDetail,
  ManagedSkillRow,
  SkillsManagerApi,
} from './api.ts'
import { ExpandableText } from './ExpandableText.tsx'
import { SkillActions } from './SkillActions.tsx'
import { SKILLS_MANAGER_NS, type SkillsManagerKey } from './locale.ts'

export interface SkillsSectionInjected {
  api: SkillsManagerApi
  remote?: {
    $on?: (event: string, listener: () => void) => () => void
  }
}

export interface SkillsSectionProps extends SkillsSectionInjected {
  /** Owner-provided close affordance from the settings section slot. */
  close: () => void
  /** Framework-provided translation seat for the registered namespace. */
  t: TranslateNS<typeof SKILLS_MANAGER_NS>
}

type Mode = 'list' | 'detail' | 'create' | 'edit' | 'import' | 'conflicts'

type EditorDraft = {
  name: string
  description: string
  whenToUse: string
  body: string
  scope: 'global' | 'project'
}

const EMPTY_DRAFT: EditorDraft = { name: '', description: '', whenToUse: '', body: '', scope: 'global' }

const styles: Record<string, CSSProperties> = {
  root: {
    width: '100%',
    minWidth: 0,
    maxWidth: '100%',
    boxSizing: 'border-box',
    padding: '16px',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    minWidth: 0,
    marginBottom: '10px',
  },
  toolbarRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    minWidth: 0,
    marginBottom: '12px',
  },
  title: { margin: 0, minWidth: 0, fontSize: '18px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' },
  search: { flex: '1 1 240px', minWidth: '180px', maxWidth: '100%' },
  button: { whiteSpace: 'nowrap', flex: '0 0 auto' },
  dangerButton: { whiteSpace: 'nowrap', flex: '0 0 auto', background: 'var(--dsw-alias-button-danger-fill, #dc2626)', borderColor: 'var(--dsw-alias-button-danger-border, #dc2626)', color: '#fff' },
  panel: { border: '1px solid var(--dsw-alias-border, #e5e7eb)', borderRadius: '8px', padding: '12px', marginBottom: '12px', background: 'var(--dsw-alias-bg-secondary, #fafafa)', minWidth: 0, boxSizing: 'border-box' },
  tableContainer: { width: '100%', minWidth: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' },
  table: { width: '100%', minWidth: 0, tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: '14px' },
  th: { textAlign: 'left', padding: '8px', borderBottom: '1px solid var(--dsw-alias-border, #e5e7eb)', overflow: 'hidden', textOverflow: 'ellipsis' },
  td: { padding: '8px', borderBottom: '1px solid var(--dsw-alias-border-subtle, #f3f4f6)', verticalAlign: 'top', minWidth: 0, overflow: 'hidden' },
  cellText: { minWidth: 0, maxWidth: '100%', overflow: 'hidden' },
  name: { display: 'block', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  location: { display: 'block', minWidth: 0, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'help' },
  actions: { whiteSpace: 'nowrap', width: '1%', textAlign: 'right' },
  error: { color: 'var(--dsw-alias-text-error, #b91c1c)', padding: '8px', background: 'var(--dsw-alias-bg-error, #fee2e2)', borderRadius: '6px', marginBottom: '8px', overflowWrap: 'anywhere' },
  info: { color: 'var(--dsw-alias-text-secondary, #1f2937)', padding: '8px', background: 'var(--dsw-alias-bg-secondary, #e5e7eb)', borderRadius: '6px', marginBottom: '8px' },
  form: { display: 'grid', gap: '10px', marginTop: '8px' },
  label: { display: 'grid', gap: '5px', fontWeight: 500 },
  input: { padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--dsw-alias-border, #ccc)', width: '100%', minWidth: 0, boxSizing: 'border-box' },
  textarea: { padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--dsw-alias-border, #ccc)', width: '100%', minWidth: 0, minHeight: '120px', boxSizing: 'border-box', fontFamily: 'monospace' },
  pre: { background: '#0f172a', color: '#e2e8f0', padding: '12px', borderRadius: '8px', overflow: 'auto', maxHeight: '400px', fontSize: '13px', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' },
  modalBackdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px', boxSizing: 'border-box' },
  modal: { background: 'var(--dsw-alias-bg-primary, #fff)', borderRadius: '10px', padding: '16px', width: 'min(640px, 100%)', maxHeight: '85vh', overflow: 'auto', boxSizing: 'border-box' },
  summary: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '10px', marginBottom: '8px' },
  summaryItem: { display: 'grid', gap: '2px', minWidth: 0 },
  summaryNumber: { fontSize: '20px', fontWeight: 700 },
  summaryLabel: { fontSize: '12px', color: 'var(--dsw-alias-text-secondary, #6b7280)', overflow: 'hidden', textOverflow: 'ellipsis' },
  list: { margin: 0, paddingLeft: '18px', fontSize: '13px', overflowWrap: 'anywhere' },
}

export function SkillsSection(props: SkillsSectionProps): ReactElement {
  const { api, remote, t } = props
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
      setError(formatError(t, 'errors.load', err))
    }
  }, [api, t])

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
    const dispose = remote.$on('skills/change', () => { void refresh() })
    return () => { dispose() }
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
      setError(formatError(t, 'errors.get', err))
    }
  }, [api, t])

  const openEdit = useCallback(async (skill: ManagedSkillRow | ManagedSkillDetail) => {
    try {
      const result = 'content' in skill ? { skill } : await api.getSkill(skill.name)
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
      setError(formatError(t, 'errors.get', err))
    }
  }, [api, t])

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
      setError(formatError(t, 'errors.save', err))
    } finally {
      setBusy(false)
    }
  }, [api, draft, mode, refresh, selected, t])

  const confirmDelete = useCallback(async () => {
    if (deleteTarget === undefined) return
    setBusy(true)
    setError(undefined)
    try {
      await api.deleteSkill(deleteTarget.name)
      setDeleteTarget(undefined)
      await refresh()
    } catch (err) {
      setError(formatError(t, 'errors.delete', err))
    } finally {
      setBusy(false)
    }
  }, [api, deleteTarget, refresh, t])

  const scan = useCallback(async () => {
    setBusy(true)
    setError(undefined)
    try {
      const result = await api.scanExternal()
      setReport(result.report)
      setMode('import')
      await refresh()
    } catch (err) {
      setError(formatError(t, 'errors.scan', err))
    } finally {
      setBusy(false)
    }
  }, [api, refresh, t])

  const resolve = useCallback(async (conflict: ConflictView, source: string) => {
    setBusy(true)
    setError(undefined)
    try {
      await api.resolveConflict(conflict.name, source)
      await refresh()
      setMode('conflicts')
    } catch (err) {
      setError(formatError(t, 'errors.resolve', err))
    } finally {
      setBusy(false)
    }
  }, [api, refresh, t])

  if (mode === 'detail' && selected !== undefined) {
    return (
      <div style={styles.root}>
        <TitleRow title={selected.name}>
          <Button variant="ghost" size="sm" style={styles.button} onClick={() => setMode('list')}>{t('detail.back')}</Button>
          <Button variant="primary" size="sm" style={styles.button} onClick={() => { void openEdit(selected) }}>{t('detail.edit')}</Button>
        </TitleRow>
        {error !== undefined ? <div style={styles.error}>{error}</div> : null}
        <div style={styles.panel}>
          <p><strong>{t('detail.description')}:</strong> {selected.description}</p>
          {selected.whenToUse !== undefined ? <p><strong>{t('detail.whenToUse')}:</strong> {selected.whenToUse}</p> : null}
          <p><strong>{t('detail.source')}:</strong> {selected.source} · <strong>{t('detail.provider')}:</strong> {selected.provider}</p>
          {selected.path !== undefined ? <p><strong>{t('detail.location')}:</strong> <LocationValue path={selected.path} t={t} /></p> : null}
          <p><strong>{t('detail.modelInvocable')}:</strong> {selected.modelInvocable ? t('status.yes') : t('status.no')} · <strong>{t('detail.userInvocable')}:</strong> {selected.userInvocable ? t('status.yes') : t('status.no')}</p>
          <pre style={styles.pre}>{selected.content}</pre>
        </div>
      </div>
    )
  }

  if (mode === 'create' || mode === 'edit') {
    return (
      <div style={styles.root}>
        <TitleRow title={mode === 'create' ? t('editor.newTitle') : t('editor.editTitle', { name: selected?.name ?? '' })}>
          <Button variant="ghost" size="sm" style={styles.button} onClick={() => setMode('list')}>{t('editor.cancel')}</Button>
          <Button variant="primary" size="sm" style={styles.button} disabled={busy} onClick={() => { void save() }}>{t('editor.save')}</Button>
        </TitleRow>
        {error !== undefined ? <div style={styles.error}>{error}</div> : null}
        <div style={styles.form}>
          <label style={styles.label}>
            {t('editor.name')}
            <input
              style={styles.input}
              value={draft.name}
              disabled={mode === 'edit'}
              onChange={event => setDraft({ ...draft, name: event.target.value })}
              placeholder={t('editor.namePlaceholder')}
            />
          </label>
          {mode === 'create' ? (
            <label style={styles.label}>
              {t('editor.scope')}
              <select
                style={styles.input}
                value={draft.scope}
                onChange={event => setDraft({ ...draft, scope: event.target.value as 'global' | 'project' })}
              >
                <option value="global">{t('editor.global')}</option>
                <option value="project">{t('editor.project')}</option>
              </select>
            </label>
          ) : null}
          <label style={styles.label}>
            {t('editor.description')}
            <textarea
              style={styles.textarea}
              value={draft.description}
              onChange={event => setDraft({ ...draft, description: event.target.value })}
            />
          </label>
          <label style={styles.label}>
            {t('editor.whenToUse')}
            <input
              style={styles.input}
              value={draft.whenToUse}
              onChange={event => setDraft({ ...draft, whenToUse: event.target.value })}
            />
          </label>
          <label style={styles.label}>
            {t('editor.body')}
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
        <TitleRow title={t('import.title')}>
          <Button variant="ghost" size="sm" style={styles.button} onClick={() => setMode('list')}>{t('import.back')}</Button>
          <Button variant="primary" size="sm" style={styles.button} disabled={busy} onClick={() => { void scan() }}>{t('import.scanAgain')}</Button>
        </TitleRow>
        {error !== undefined ? <div style={styles.error}>{error}</div> : null}
        <ImportReportView report={report} t={t} />
      </div>
    )
  }

  if (mode === 'conflicts') {
    return (
      <div style={styles.root}>
        <TitleRow title={t('import.conflictsTitle')}>
          <Button variant="ghost" size="sm" style={styles.button} onClick={() => setMode('list')}>{t('import.back')}</Button>
        </TitleRow>
        {error !== undefined ? <div style={styles.error}>{error}</div> : null}
        {conflicts.length === 0 ? <div style={styles.info}>{t('import.noPendingConflicts')}</div> : (
          <div style={styles.panel}>
            {conflicts.map(conflict => (
              <div key={conflict.name} style={{ marginBottom: '16px', borderBottom: '1px solid #e5e7eb', paddingBottom: '12px' }}>
                <strong>{conflict.name}</strong>
                <p style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0', overflowWrap: 'anywhere' }}>{conflict.reason}</p>
                {conflict.existing !== undefined ? <p style={{ fontSize: '13px' }}><strong>{t('import.dshExisting')}:</strong> {conflict.existing.path ?? conflict.existing.name}</p> : null}
                {conflict.candidates.map(candidate => (
                  <Button
                    key={candidate.source}
                    variant="outline"
                    size="sm"
                    style={{ ...styles.button, marginTop: '6px', marginRight: '6px' }}
                    disabled={busy}
                    onClick={() => { void resolve(conflict, candidate.source) }}
                  >
                    {t('import.use', { label: candidate.label })}
                  </Button>
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
      <div style={styles.titleRow}>
        <h2 style={styles.title}>{t('nav.title')}</h2>
        <Button variant="primary" size="sm" style={styles.button} onClick={openCreate}>{t('toolbar.newSkill')}</Button>
      </div>
      <div style={styles.toolbarRow}>
        <Input
          style={styles.search}
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder={t('toolbar.searchPlaceholder')}
          aria-label={t('toolbar.searchPlaceholder')}
        />
        <Button variant="outline" size="sm" style={styles.button} disabled={busy} onClick={() => setMode('conflicts')}>
          {t('toolbar.conflicts')} ({conflicts.length})
        </Button>
        <Button variant="outline" size="sm" style={styles.button} disabled={busy} onClick={() => { void scan() }}>{t('toolbar.scanExternal')}</Button>
      </div>

      {error !== undefined ? <div style={styles.error}>{error}</div> : null}
      {loading ? <div style={styles.info}>{t('status.loading')}</div> : null}

      {report !== undefined ? (
        <div style={styles.panel}>
          <ImportSummary report={report} t={t} />
          <Button variant="ghost" size="sm" style={styles.button} onClick={() => setMode('import')}>{t('import.viewDetails')}</Button>
        </div>
      ) : null}

      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <colgroup>
            <col style={{ width: '18%' }} />
            <col style={{ width: '34%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '24%' }} />
            <col style={{ width: '12%' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={styles.th}>{t('table.name')}</th>
              <th style={styles.th}>{t('table.description')}</th>
              <th style={styles.th}>{t('table.scope')}</th>
              <th style={styles.th}>{t('table.location')}</th>
              <th style={{ ...styles.th, ...styles.actions }}>{t('table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(skill => (
              <tr key={skill.name}>
                <td style={styles.td}><span style={styles.name} title={skill.name}><code>{skill.name}</code></span></td>
                <td style={styles.td}><ExpandableText t={t}>{skill.description}</ExpandableText></td>
                <td style={styles.td}><span style={styles.cellText}>{skill.source}</span></td>
                <td style={styles.td}><LocationValue path={skill.path} t={t} /></td>
                <td style={{ ...styles.td, ...styles.actions }}>
                  <SkillActions
                    t={t}
                    disabled={busy}
                    onView={() => { void openDetail(skill) }}
                    onEdit={() => { void openEdit(skill) }}
                    onDelete={() => setDeleteTarget(skill)}
                  />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !loading ? (
              <tr><td colSpan={5} style={styles.td}>{t('table.empty')}</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {deleteTarget !== undefined ? (
        <div style={styles.modalBackdrop}>
          <div style={styles.modal} role="dialog" aria-modal="true" aria-labelledby="skills-manager-delete-title">
            <h3 id="skills-manager-delete-title">{t('delete.title', { name: deleteTarget.name })}</h3>
            <p>{t('delete.warning')}</p>
            {error !== undefined ? <div style={styles.error}>{error}</div> : null}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Button variant="ghost" size="sm" style={styles.button} disabled={busy} onClick={() => setDeleteTarget(undefined)}>{t('delete.cancel')}</Button>
              <Button variant="primary" size="sm" style={styles.dangerButton} disabled={busy} onClick={() => { void confirmDelete() }}>{t('delete.confirm')}</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function TitleRow({ title, children }: { title: string; children: ReactElement | ReactElement[] }): ReactElement {
  return (
    <div style={styles.titleRow}>
      <h2 style={styles.title}>{title}</h2>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'nowrap', minWidth: 0 }}>{children}</div>
    </div>
  )
}

function LocationValue({ path, t }: { path?: string; t: TranslateNS<typeof SKILLS_MANAGER_NS> }): ReactElement {
  if (path === undefined || path.length === 0) return <span>{t('table.locationUnavailable')}</span>
  return (
    <Tooltip label={path} side="top" maxWidth={480}>
      <span tabIndex={0} title={path} style={styles.location}><code style={{ fontSize: '12px' }}>{path}</code></span>
    </Tooltip>
  )
}

function ImportSummary({ report, t }: { report: ImportReport; t: TranslateNS<typeof SKILLS_MANAGER_NS> }): ReactElement {
  return (
    <div style={styles.summary}>
      <SummaryItem label={t('import.summary.scanned')} value={report.scanned} />
      <SummaryItem label={t('import.summary.imported')} value={report.imported} />
      <SummaryItem label={t('import.summary.duplicates')} value={report.duplicates} />
      <SummaryItem label={t('import.summary.conflicts')} value={report.conflicts} />
      <SummaryItem label={t('import.summary.invalid')} value={report.invalid} />
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

function ImportReportView({ report, t }: { report: ImportReport; t: TranslateNS<typeof SKILLS_MANAGER_NS> }): ReactElement {
  const [filter, setFilter] = useState<'all' | ImportReport['items'][number]['result']>('all')
  const items = report.items.filter(item => filter === 'all' || item.result === filter)
  const filters = ['all', 'new', 'duplicate', 'conflict', 'invalid', 'skipped'] as const
  return (
    <div style={styles.panel}>
      <ImportSummary report={report} t={t} />
      <div style={{ margin: '8px 0', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {filters.map(name => (
          <Button
            key={name}
            variant={filter === name ? 'outline' : 'ghost'}
            size="sm"
            style={styles.button}
            onClick={() => setFilter(name === 'all' ? 'all' : name)}
          >
            {name === 'all' ? t('import.filter.all') : t(`import.filter.${name}` as SkillsManagerKey)}
          </Button>
        ))}
      </div>
      {items.length === 0 ? <p>{t('import.noItems')}</p> : (
        <ul style={styles.list}>
          {items.map((item, index) => (
            <li key={`${item.source}-${item.skill}-${index}`} style={{ marginBottom: '4px' }}>
              <code>{item.skill}</code> ({item.source}) — <strong>{t(`import.result.${item.result}` as SkillsManagerKey)}</strong> — {item.reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function formatError(t: TranslateNS<typeof SKILLS_MANAGER_NS>, key: 'errors.load' | 'errors.get' | 'errors.save' | 'errors.delete' | 'errors.scan' | 'errors.resolve', error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error)
  return `${t(key)}: ${detail}`
}

