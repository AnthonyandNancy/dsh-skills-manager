/**
 * Scope picker for the skill editor: `global` or `project`.
 *
 * Composition follows DSH's own settings-side permission selector
 * (ui-permission-presets PermissionRow): a plain button trigger carrying
 * `aria-haspopup`/`aria-expanded` plus the shared chevron glyph, anchoring a
 * `Menu` whose `selectedId` draws the native check mark. Keyboard, Escape and
 * outside-click dismissal all belong to the primitive.
 */

import { useState } from 'react'
import type { ReactElement } from 'react'
import { IconChevronDownOutline14, Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { SKILLS_MANAGER_NS } from './locale.ts'
import styles from './ScopeSelect.module.css'

/** The two scopes a managed skill can live in. */
export type SkillScope = 'global' | 'project'

export interface ScopeSelectProps {
  value: SkillScope
  onChange: (value: SkillScope) => void
  disabled?: boolean
  t: TranslateNS<typeof SKILLS_MANAGER_NS>
}

export function ScopeSelect({ value, onChange, disabled = false, t }: ScopeSelectProps): ReactElement {
  const [open, setOpen] = useState(false)
  return (
    <Menu
      open={open}
      onClose={() => { setOpen(false) }}
      items={[
        { id: 'global', label: t('editor.global') },
        { id: 'project', label: t('editor.project') },
      ]}
      selectedId={value}
      onSelect={(id) => {
        setOpen(false)
        onChange(id as SkillScope)
      }}
      // The editor renders inside the Settings options scrollport, which would
      // crop an in-place list.
      portal
      className={styles.root}
      anchor={(
        <button
          type="button"
          className={styles.trigger}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={t('editor.scope')}
          disabled={disabled}
          onClick={() => { setOpen(current => !current) }}
        >
          <span className={styles.triggerLabel}>{value === 'project' ? t('editor.project') : t('editor.global')}</span>
          <IconChevronDownOutline14 className={styles.chevron} />
        </button>
      )}
    />
  )
}
