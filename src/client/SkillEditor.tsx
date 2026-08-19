import type { Dispatch, ReactElement, SetStateAction } from 'react'
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { SKILLS_MANAGER_NS } from './locale.ts'
import { ScopeSelect, type SkillScope } from './ScopeSelect.tsx'
import styles from './SkillsSection.module.css'

export type EditorDraft = {
  name: string
  description: string
  whenToUse: string
  body: string
  scope: SkillScope
}

export const EMPTY_DRAFT: EditorDraft = {
  name: '',
  description: '',
  whenToUse: '',
  body: '',
  scope: 'global',
}

export interface SkillEditorProps {
  mode: 'create' | 'edit'
  draft: EditorDraft
  setDraft: Dispatch<SetStateAction<EditorDraft>>
  selectedName?: string
  busy: boolean
  error?: string
  onCancel: () => void
  onSave: () => void
  t: TranslateNS<typeof SKILLS_MANAGER_NS>
}

export function SkillEditor({ mode, draft, setDraft, selectedName, busy, error, onCancel, onSave, t }: SkillEditorProps): ReactElement {
  const editing = mode === 'edit'
  const title = editing ? t('editor.editTitle', { name: selectedName ?? draft.name }) : t('editor.newTitle')
  const update = (patch: Partial<EditorDraft>) => setDraft(current => ({ ...current, ...patch }))

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <h2 className={styles.pageTitle}>{title}</h2>
        <div className={styles.titleActions}>
          <Button variant="ghost" size="sm" disabled={busy} onClick={onCancel}>{t('editor.cancel')}</Button>
          <Button variant="primary" size="sm" disabled={busy} onClick={onSave}>{t('editor.save')}</Button>
        </div>
      </div>
      {error !== undefined ? <div className={styles.error} role="alert">{error}</div> : null}
      <div className={styles.editorForm}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t('editor.name')}</span>
          <Input
            className={styles.inputField}
            value={draft.name}
            disabled={editing}
            onChange={event => update({ name: event.target.value })}
            placeholder={t('editor.namePlaceholder')}
            aria-label={t('editor.name')}
          />
        </label>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>{t('editor.scope')}</span>
          <ScopeSelect value={draft.scope} onChange={scope => update({ scope })} disabled={editing} t={t} />
        </div>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t('editor.description')}</span>
          <textarea
            className={styles.textarea}
            value={draft.description}
            onChange={event => update({ description: event.target.value })}
            rows={4}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t('editor.whenToUse')}</span>
          <Input
            className={styles.inputField}
            value={draft.whenToUse}
            onChange={event => update({ whenToUse: event.target.value })}
            aria-label={t('editor.whenToUse')}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t('editor.body')}</span>
          <textarea
            className={`${styles.textarea} ${styles.codeTextarea}`}
            value={draft.body}
            onChange={event => update({ body: event.target.value })}
            rows={14}
            spellCheck={false}
          />
        </label>
      </div>
    </div>
  )
}
