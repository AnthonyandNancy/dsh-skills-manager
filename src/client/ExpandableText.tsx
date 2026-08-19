import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode, ReactElement } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { SKILLS_MANAGER_NS } from './locale.ts'
import { hasCollapsedOverflow } from './overflow.ts'
import styles from './ExpandableText.module.css'

export interface ExpandableTextProps {
  children: ReactNode
  t: TranslateNS<typeof SKILLS_MANAGER_NS>
  collapsedLines?: number
  className?: string
  style?: CSSProperties
}

/** Text that clamps to two lines and expands only when it really overflows. */
export function ExpandableText({ children, t, collapsedLines = 2, className, style }: ExpandableTextProps): ReactElement {
  const textRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [overflow, setOverflow] = useState(false)

  const measureOverflow = useCallback(() => {
    const node = textRef.current
    if (node === null || expanded) return
    setOverflow(hasCollapsedOverflow(node.scrollHeight, node.clientHeight))
  }, [expanded])

  useLayoutEffect(() => {
    measureOverflow()
    const node = textRef.current
    if (node === null) return
    const resizeObserver = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measureOverflow)
    resizeObserver?.observe(node)
    window.addEventListener('resize', measureOverflow)
    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', measureOverflow)
    }
  }, [children, collapsedLines, measureOverflow])

  const collapsedStyle: CSSProperties = expanded
    ? { overflowWrap: 'anywhere' }
    : { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: collapsedLines, overflow: 'hidden', overflowWrap: 'anywhere' }

  return (
    <div className={className} style={style}>
      <div ref={textRef} style={collapsedStyle}>{children}</div>
      {overflow ? (
        <button type="button" className={styles.toggle} aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
          {expanded ? t('text.collapse') : t('text.expand')}
        </button>
      ) : null}
    </div>
  )
}
