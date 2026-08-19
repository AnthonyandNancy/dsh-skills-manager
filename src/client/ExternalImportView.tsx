import { useMemo, useState } from 'react'
import type { ReactElement } from 'react'
import { Button, Pill } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { ImportReport } from './api.ts'
import { ExpandableText } from './ExpandableText.tsx'
import { SKILLS_MANAGER_NS, type SkillsManagerKey } from './locale.ts'
import styles from './SkillsSection.module.css'

export interface ExternalImportViewProps {
  report: ImportReport
  busy: boolean
  onBack: () => void
  onScanAgain: () => void
  t: TranslateNS<typeof SKILLS_MANAGER_NS>
}

type Filter = 'all' | ImportReport['items'][number]['result']

export function ExternalImportView({ report, busy, onBack, onScanAgain, t }: ExternalImportViewProps): ReactElement {
  const [filter, setFilter] = useState<Filter>('all')
  const items = useMemo(
    () => report.items.filter(item => filter === 'all' || item.result === filter),
    [filter, report.items],
  )
  const groups = report.duplicateGroups
    .filter(group => group.candidateCount > 1)
    .sort((a, b) => b.candidateCount - a.candidateCount)
  const filters = ['all', 'new', 'duplicate', 'conflict', 'invalid', 'skipped'] as const

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <h2 className={styles.pageTitle}>{t('import.title')}</h2>
        <div className={styles.titleActions}>
          <Button variant="ghost" size="sm" onClick={onBack}>{t('import.back')}</Button>
          <Button variant="primary" size="sm" disabled={busy} onClick={onScanAgain}>{t('import.scanAgain')}</Button>
        </div>
      </div>
      <section className={styles.importSection} aria-labelledby="skills-import-overview">
        <h3 id="skills-import-overview" className={styles.sectionTitle}>{t('import.overview.title')}</h3>
        <div className={styles.summaryGrid}>
          <SummaryItem label={t('import.summary.scanned')} value={report.scannedCandidates} />
          <SummaryItem label={t('import.summary.inDsh')} value={report.inDsh} />
          <SummaryItem label={t('import.summary.deduplicated')} value={report.duplicateCopies} />
          <SummaryItem label={t('import.summary.conflicts')} value={report.conflicts} />
          <SummaryItem label={t('import.summary.invalid')} value={report.invalid} />
        </div>
        <p className={styles.caption}>{t('import.lastScan', { time: formatTimestamp(report.finishedAt) })}</p>
      </section>

      <section className={styles.importSection} aria-labelledby="skills-import-details">
        <h3 id="skills-import-details" className={styles.sectionTitle}>{t('import.details.title')}</h3>
        <div className={styles.metricList}>
          <MetricRow label={t('import.details.scanned')} value={report.scannedCandidates} />
          <MetricRow label={t('import.details.uniqueValid')} value={report.uniqueValidSkills} />
          <MetricRow label={t('import.details.inDsh')} value={report.inDsh} />
          <MetricRow label={t('import.details.importedThisScan')} value={report.importedThisScan} />
          <MetricRow label={t('import.details.deduplicated')} value={report.duplicateCopies} />
          <MetricRow label={t('import.details.conflicts')} value={report.conflicts} />
          <MetricRow label={t('import.details.invalid')} value={report.invalid} />
          {report.failed > 0 ? <MetricRow label={t('import.details.failed')} value={report.failed} /> : null}
        </div>
        <p className={styles.note}>{t('import.unitNote')}</p>
      </section>

      <section className={styles.importSection} aria-labelledby="skills-import-breakdown">
        <h3 id="skills-import-breakdown" className={styles.sectionTitle}>{t('import.breakdown.title')}</h3>
        <div className={styles.metricList}>
          <MetricRow label={t('import.breakdown.samePath')} value={report.duplicateBreakdown.samePath} />
          <MetricRow label={t('import.breakdown.sameContent')} value={report.duplicateBreakdown.sameContent} />
          <MetricRow label={t('import.breakdown.alreadyInDsh')} value={report.duplicateBreakdown.alreadyInDsh} />
          <MetricRow label={t('import.breakdown.total')} value={report.duplicateCopies} strong />
        </div>
      </section>

      {groups.length > 0 ? (
        <section className={styles.importSection} aria-labelledby="skills-import-groups">
          <h3 id="skills-import-groups" className={styles.sectionTitle}>{t('import.groups.title')}</h3>
          <div className={styles.groupList}>
            {groups.map(group => (
              <div key={group.key} className={styles.groupRow}>
                <code className={styles.groupName}>{group.name}</code>
                <span className={styles.groupMeta}>{t('import.groups.status')}: {group.inDsh ? t('import.groups.statusInDsh') : t('import.groups.statusNotInDsh')}</span>
                <span className={styles.groupMeta}>{t('import.groups.sources')}: {[...new Set(group.sources.map(source => source.source))].join(', ')}</span>
                <span className={styles.groupMeta}>{t('import.groups.candidates')}: {group.candidateCount} · {t('import.groups.uniqueSkill')}: 1</span>
                <span className={styles.groupMeta}>{t('import.groups.result')}: {group.importedThisScan ? t('import.groups.resultImported') : t('import.groups.resultMerged')}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.importSection} aria-labelledby="skills-import-records">
        <h3 id="skills-import-records" className={styles.sectionTitle}>{t('import.records.title')}</h3>
        <div className={styles.filterRow} role="group" aria-label={t('import.records.title')}>
          {filters.map(name => (
            <Pill
              key={name}
              active={filter === name}
              onClick={() => setFilter(name === 'all' ? 'all' : name)}
            >
              {name === 'all' ? t('import.filter.all') : t(`import.filter.${name}` as SkillsManagerKey)}
            </Pill>
          ))}
        </div>
        {items.length === 0 ? <p className={styles.empty}>{t('import.noItems')}</p> : (
          <div className={styles.recordList}>
            {items.map((item, index) => (
              <article key={`${item.source}-${item.skill}-${index}`} className={styles.recordRow}>
                <div className={styles.recordHeader}>
                  <code className={styles.recordSkill}>{item.skill}</code>
                  <span className={styles.recordSource}>{item.source}</span>
                  <Pill>{t(`import.result.${item.result}` as SkillsManagerKey)}</Pill>
                </div>
                <ExpandableText t={t} className={styles.recordReason}>{item.reason}</ExpandableText>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function SummaryItem({ label, value }: { label: string; value: number }): ReactElement {
  return <div className={styles.summaryItem}><strong className={styles.summaryNumber}>{value}</strong><span className={styles.summaryLabel}>{label}</span></div>
}

function MetricRow({ label, value, strong = false }: { label: string; value: number; strong?: boolean }): ReactElement {
  return <div className={`${styles.metricRow} ${strong ? styles.metricRowStrong : ''}`}><span>{label}</span><strong>{value}</strong></div>
}

function formatTimestamp(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}
