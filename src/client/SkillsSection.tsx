/** Settings → Skills management surface over DSH's native Skills API. */

import { Component, useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { Button, Input, Modal, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { ConflictView, ImportReport, ManagedSkillDetail, ManagedSkillRow, SkillsManagerApi } from './api.ts'
import { ExternalImportView } from './ExternalImportView.tsx'
import { SkillEditor, EMPTY_DRAFT, type EditorDraft } from './SkillEditor.tsx'
import { ExpandableText } from './ExpandableText.tsx'
import { SkillActions } from './SkillActions.tsx'
import { canOpenSkillsDirectory, openSkillsDirectory as openFixedSkillsDirectory } from './open-skills-folder.ts'
import { SKILLS_MANAGER_NS } from './locale.ts'
import { readHostDescription, subscribeHostDescription, type HostDescriptionSourceLike } from './compat.ts'
import styles from './SkillsSection.module.css'
import table from './SkillsTable.module.css'

export interface SkillsSectionInjected {
  api: SkillsManagerApi
  connection?: ConnectionHandle
  remote?: { $on?: (event: string, listener: () => void) => () => void }
}

export interface SkillsSectionProps extends SkillsSectionInjected {
  close: () => void
  t: TranslateNS<typeof SKILLS_MANAGER_NS>
}

type Mode = 'list' | 'detail' | 'create' | 'edit' | 'import' | 'conflicts'

export function SkillsSection(props: SkillsSectionProps): ReactElement {
  return <SkillsErrorBoundary t={props.t}><SkillsSectionContent {...props} /></SkillsErrorBoundary>
}

function SkillsSectionContent(props: SkillsSectionProps): ReactElement {
  const { api, connection, remote, t } = props
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
  const hostDescriptionSource = connection?.hostDescription as HostDescriptionSourceLike | undefined
  const [hostDescription, setHostDescription] = useState(() => readHostDescription(hostDescriptionSource))

  useEffect(() => {
    setHostDescription(readHostDescription(hostDescriptionSource))
    return subscribeHostDescription(hostDescriptionSource, () => setHostDescription(readHostDescription(hostDescriptionSource)))
  }, [hostDescriptionSource])

  const loadSkills = useCallback(async () => {
    try {
      setSkills((await api.listSkills()).skills)
    } catch (err) {
      setError(formatError(t, 'errors.load', err))
    }
  }, [api, t])

  const loadConflicts = useCallback(async () => {
    try {
      setConflicts((await api.listConflicts()).conflicts)
    } catch {
      setConflicts([])
    }
  }, [api])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(undefined)
    await Promise.all([loadSkills(), loadConflicts()])
    setLoading(false)
  }, [loadConflicts, loadSkills])

  useEffect(() => { void refresh() }, [refresh])

  useEffect(() => {
    if (remote?.$on === undefined) return
    const dispose = remote.$on('skills/change', () => { void refresh() })
    return () => { dispose() }
  }, [remote, refresh])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return query.length === 0
      ? skills
      : skills.filter(skill => skill.name.toLowerCase().includes(query) || skill.description.toLowerCase().includes(query))
  }, [search, skills])

  const openDetail = useCallback(async (skill: ManagedSkillRow) => {
    try {
      setSelected((await api.getSkill(skill.name)).skill)
      setMode('detail')
    } catch (err) {
      setError(formatError(t, 'errors.get', err))
    }
  }, [api, t])

  const openEdit = useCallback(async (skill: ManagedSkillRow | ManagedSkillDetail) => {
    try {
      const detail = 'content' in skill ? skill : (await api.getSkill(skill.name)).skill
      setSelected(detail)
      setDraft({
        name: detail.name,
        description: detail.description,
        whenToUse: detail.whenToUse ?? '',
        body: detail.content,
        scope: detail.source.includes('project') ? 'project' : 'global',
      })
      setMode('edit')
    } catch (err) {
      setError(formatError(t, 'errors.get', err))
    }
  }, [api, t])

  const openCreate = useCallback(() => {
    setDraft(EMPTY_DRAFT)
    setSelected(undefined)
    setMode('create')
  }, [])

  const save = useCallback(async () => {
    setBusy(true)
    setError(undefined)
    try {
      if (mode === 'create') {
        await api.createSkill({ name: draft.name, description: draft.description, whenToUse: draft.whenToUse, body: draft.body, scope: draft.scope })
      } else if (mode === 'edit' && selected !== undefined) {
        await api.updateSkill({ name: selected.name, description: draft.description, whenToUse: draft.whenToUse, body: draft.body })
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
      setReport((await api.scanExternal()).report)
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

  const openSkillsDirectory = useCallback(async () => {
    if (connection === undefined || !connection.isLoopback || hostDescription?.canOpenPath !== true) return
    setBusy(true)
    setError(undefined)
    try {
      await openFixedSkillsDirectory(api, connection)
    } catch (err) {
      setError(formatError(t, 'errors.openSkillsDirectory', err))
    } finally {
      setBusy(false)
    }
  }, [api, connection, hostDescription?.canOpenPath, t])

  const canOpenFolder = canOpenSkillsDirectory(connection, hostDescription)
  const unavailableLabel = t('toolbar.openSkillsFolderUnavailable')

  if (mode === 'detail' && selected !== undefined) {
    return (
      <div className={styles.page}>
        <TitleRow title={selected.name}>
          <Button variant="ghost" size="sm" onClick={() => setMode('list')}>{t('detail.back')}</Button>
          <Button variant="primary" size="sm" onClick={() => { void openEdit(selected) }}>{t('detail.edit')}</Button>
        </TitleRow>
        {error !== undefined ? <div className={styles.error} role="alert">{error}</div> : null}
        <section className={styles.importSection}>
          <p><strong>{t('detail.description')}:</strong> {selected.description}</p>
          {selected.whenToUse !== undefined ? <p><strong>{t('detail.whenToUse')}:</strong> {selected.whenToUse}</p> : null}
          <p><strong>{t('detail.source')}:</strong> {selected.source} · <strong>{t('detail.provider')}:</strong> {selected.provider}</p>
          {selected.path !== undefined ? <p><strong>{t('detail.location')}:</strong> <LocationValue path={selected.path} t={t} /></p> : null}
          <p><strong>{t('detail.modelInvocable')}:</strong> {selected.modelInvocable ? t('status.yes') : t('status.no')} · <strong>{t('detail.userInvocable')}:</strong> {selected.userInvocable ? t('status.yes') : t('status.no')}</p>
          <pre className={styles.codeBlock}>{selected.content}</pre>
        </section>
      </div>
    )
  }

  if (mode === 'create' || mode === 'edit') {
    return <SkillEditor mode={mode} draft={draft} setDraft={setDraft} selectedName={selected?.name} busy={busy} error={error} onCancel={() => setMode('list')} onSave={() => { void save() }} t={t} />
  }

  if (mode === 'import' && report !== undefined) {
    return <ExternalImportView report={report} busy={busy} onBack={() => setMode('list')} onScanAgain={() => { void scan() }} t={t} />
  }

  if (mode === 'conflicts') {
    return (
      <div className={styles.page}>
        <TitleRow title={t('import.conflictsTitle')}><Button variant="ghost" size="sm" onClick={() => setMode('list')}>{t('import.back')}</Button></TitleRow>
        {error !== undefined ? <div className={styles.error} role="alert">{error}</div> : null}
        {conflicts.length === 0 ? <div className={styles.info}>{t('import.noPendingConflicts')}</div> : (
          <div className={styles.groupList}>
            {conflicts.map(conflict => (
              <div key={conflict.name} className={styles.groupRow}>
                <strong>{conflict.name}</strong>
                <span className={styles.groupMeta}>{conflict.reason}</span>
                {conflict.existing !== undefined ? <span className={styles.groupMeta}><strong>{t('import.dshExisting')}:</strong> {conflict.existing.path ?? conflict.existing.name}</span> : null}
                <div className={styles.titleActions}>{conflict.candidates.map(candidate => <Button key={candidate.source} variant="outline" size="sm" disabled={busy} onClick={() => { void resolve(conflict, candidate.source) }}>{t('import.use', { label: candidate.label })}</Button>)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`${styles.page} ${styles.listPage}`}>
      <div className={styles.titleRow}>
        <h2 className={styles.pageTitle}>{t('nav.title')}</h2>
        <div className={styles.titleActions}>
          <Tooltip label={unavailableLabel} side="top" disabled={canOpenFolder}>
            <span>
              <Button variant="outline" size="sm" disabled={!canOpenFolder || busy} onClick={() => { void openSkillsDirectory() }} title={!canOpenFolder ? unavailableLabel : undefined}>{t('toolbar.openSkillsFolder')}</Button>
            </span>
          </Tooltip>
          <Button variant="primary" size="sm" disabled={busy} onClick={openCreate}>{t('toolbar.newSkill')}</Button>
        </div>
      </div>
      <div className={styles.toolbar}>
        <Input className={styles.search} value={search} onChange={event => setSearch(event.target.value)} placeholder={t('toolbar.searchPlaceholder')} aria-label={t('toolbar.searchPlaceholder')} />
        <Button variant="outline" size="sm" disabled={busy} onClick={() => setMode('conflicts')}>{t('toolbar.conflicts')} ({conflicts.length})</Button>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => { void scan() }}>{t('toolbar.scanExternal')}</Button>
      </div>
      {error !== undefined ? <div className={styles.error} role="alert">{error}</div> : null}
      {loading ? <div className={styles.info}>{t('status.loading')}</div> : null}
      <div className={table.viewport}>
        <table className={table.table}>
          <thead>
            <tr>
              <th className={`${table.headerCell} ${table.nameColumn}`}>{t('table.name')}</th>
              <th className={`${table.headerCell} ${table.descriptionColumn}`}>{t('table.description')}</th>
              <th className={`${table.headerCell} ${table.scopeColumn}`}>{t('table.scope')}</th>
              <th className={`${table.headerCell} ${table.locationColumn}`}>{t('table.location')}</th>
              <th className={`${table.headerCell} ${table.actionsHeader}`}>{t('table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(skill => (
              <tr key={skill.name}>
                <td className={table.cell}><span className={styles.skillName} title={skill.name}><code>{skill.name}</code></span></td>
                <td className={table.cell}><ExpandableText t={t}>{skill.description}</ExpandableText></td>
                <td className={table.cell}>{skill.source}</td>
                <td className={table.cell}><LocationValue path={skill.path} t={t} /></td>
                <td className={`${table.cell} ${table.actionsCell}`}><SkillActions t={t} disabled={busy} onView={() => { void openDetail(skill) }} onEdit={() => { void openEdit(skill) }} onDelete={() => setDeleteTarget(skill)} /></td>
              </tr>
            ))}
            {filtered.length === 0 && !loading ? <tr><td colSpan={5} className={table.empty}>{t('table.empty')}</td></tr> : null}
          </tbody>
        </table>
      </div>
      <Modal
        open={deleteTarget !== undefined}
        onClose={() => { if (!busy) setDeleteTarget(undefined) }}
        title={deleteTarget === undefined ? t('delete.title', { name: '' }) : t('delete.title', { name: deleteTarget.name })}
        description={t('delete.warning')}
        className={styles.modal}
        footer={(
          <div className={styles.modalActions}>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => setDeleteTarget(undefined)}>{t('delete.cancel')}</Button>
            <Button variant="outline" size="sm" className={styles.dangerButton} disabled={busy} onClick={() => { void confirmDelete() }}>{t('delete.confirm')}</Button>
          </div>
        )}
      >
        {error !== undefined ? <div className={styles.error} role="alert">{error}</div> : null}
      </Modal>
    </div>
  )
}

function TitleRow({ title, children }: { title: string; children: ReactElement | ReactElement[] }): ReactElement {
  return <div className={styles.titleRow}><h2 className={styles.pageTitle}>{title}</h2><div className={styles.titleActions}>{children}</div></div>
}

function LocationValue({ path, t }: { path?: string; t: TranslateNS<typeof SKILLS_MANAGER_NS> }): ReactElement {
  if (path === undefined || path.length === 0) return <span>{t('table.locationUnavailable')}</span>
  return <Tooltip label={path} side="top" maxWidth={480}><span tabIndex={0} title={path} className={styles.location}><code>{path}</code></span></Tooltip>
}

type ErrorKey = 'errors.load' | 'errors.get' | 'errors.save' | 'errors.delete' | 'errors.scan' | 'errors.resolve' | 'errors.openSkillsDirectory'

interface SkillsErrorBoundaryProps {
  t: TranslateNS<typeof SKILLS_MANAGER_NS>
  children: ReactNode
}

interface SkillsErrorBoundaryState {
  error?: Error
}

class SkillsErrorBoundary extends Component<SkillsErrorBoundaryProps, SkillsErrorBoundaryState> {
  state: SkillsErrorBoundaryState = {}

  static getDerivedStateFromError(error: Error): SkillsErrorBoundaryState {
    return { error }
  }

  render(): ReactElement {
    if (this.state.error !== undefined) {
      return <div className={styles.page} role="alert"><p className={styles.error}>{this.props.t('errors.render')}: {this.state.error.message}</p><Button variant="outline" size="sm" onClick={() => this.setState({ error: undefined })}>{this.props.t('detail.back')}</Button></div>
    }
    return <>{this.props.children}</>
  }
}

function formatError(t: TranslateNS<typeof SKILLS_MANAGER_NS>, key: ErrorKey, error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error)
  return `${t(key)}: ${detail}`
}
