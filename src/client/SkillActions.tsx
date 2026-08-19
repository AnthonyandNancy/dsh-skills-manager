import { useState } from 'react'
import type { ReactElement } from 'react'
import { Button, Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { SKILLS_MANAGER_NS } from './locale.ts'
import styles from './SkillActions.module.css'

export interface SkillActionsProps {
  t: TranslateNS<typeof SKILLS_MANAGER_NS>
  onView: () => void
  onEdit: () => void
  onDelete: () => void
  disabled?: boolean
}

/** Compact row actions: one stable-width trigger and a DSH-native menu. */
export function SkillActions({ t, onView, onEdit, onDelete, disabled = false }: SkillActionsProps): ReactElement {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  return (
    <Menu
      open={open}
      onClose={close}
      onSelect={(id) => {
        close()
        if (id === 'view') onView()
        if (id === 'edit') onEdit()
        if (id === 'delete') onDelete()
      }}
      items={[
        { id: 'view', label: t('table.view'), disabled },
        { id: 'edit', label: t('table.edit'), disabled },
        { id: 'delete', label: t('table.delete'), danger: true, disabled },
      ]}
      align="end"
      portal
      compact
      anchor={(
        <Button
          variant="toolbar"
          size="sm"
          aria-label={t('actions.label')}
          aria-haspopup="menu"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => setOpen(value => !value)}
          className={styles.trigger}
        >
          ⋯
        </Button>
      )}
    />
  )
}
