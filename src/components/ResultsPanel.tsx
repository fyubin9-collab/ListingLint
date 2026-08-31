import { useMemo, useState } from 'react'
import { getIssueKey } from '../domain/issues'
import { FIELD_NAMES } from '../domain/mapping'
import type { LintIssue } from '../domain/types'

type IssueFilter = 'all' | 'error' | 'warning'
const ISSUE_GROUP_PAGE_SIZE = 20

interface IssueGroup {
  key: string
  sourceRows: number[]
  sku: string
  issues: LintIssue[]
  errors: number
  warnings: number
}

interface ResultsPanelProps {
  issues: LintIssue[]
  productCount: number
  selectedIssue: LintIssue | null
  onLocate: (issue: LintIssue) => void
  onExport: () => void
  exporting: boolean
}

function issueGroupKey(issue: LintIssue): string {
  if (issue.sku) return `sku:${issue.sku.toLocaleLowerCase()}`
  if (issue.sourceRow !== null) return `row:${issue.sourceRow}`
  return 'file'
}

function groupIssues(issues: LintIssue[]): IssueGroup[] {
  const groups = new Map<string, IssueGroup>()
  issues.forEach((issue) => {
    const key = issueGroupKey(issue)
    const current = groups.get(key) ?? {
      key,
      sourceRows: [],
      sku: issue.sku,
      issues: [],
      errors: 0,
      warnings: 0
    }
    if (issue.sourceRow !== null && !current.sourceRows.includes(issue.sourceRow)) {
      current.sourceRows.push(issue.sourceRow)
    }
    current.issues.push(issue)
    current.errors += issue.severity === 'error' ? 1 : 0
    current.warnings += issue.severity === 'warning' ? 1 : 0
    groups.set(key, current)
  })
  return [...groups.values()]
}

function fieldName(issue: LintIssue): string {
  if (issue.field === 'images') return '商品图片'
  if (issue.field === 'file') return '文件'
  return FIELD_NAMES[issue.field]
}

export function ResultsPanel({
  issues,
  productCount,
  selectedIssue,
  onLocate,
  onExport,
  exporting
}: ResultsPanelProps) {
  const [filter, setFilter] = useState<IssueFilter>('all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const errors = issues.filter((issue) => issue.severity === 'error').length
  const warnings = issues.filter((issue) => issue.severity === 'warning').length
  const selectedIssueKey = selectedIssue ? getIssueKey(selectedIssue) : null

  const visibleIssues = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return issues.filter((issue) => {
      if (filter !== 'all' && issue.severity !== filter) return false
      if (!normalizedQuery) return true
      return [
        issue.sku,
        issue.code,
        issue.ruleId,
        issue.message,
        issue.suggestion,
        fieldName(issue),
        String(issue.sourceRow ?? '')
      ]
        .join(' ')
        .toLocaleLowerCase()
        .includes(normalizedQuery)
    })
  }, [filter, issues, query])
  const visibleGroups = useMemo(() => groupIssues(visibleIssues), [visibleIssues])
  const pageCount = Math.max(1, Math.ceil(visibleGroups.length / ISSUE_GROUP_PAGE_SIZE))
  const visiblePage = Math.min(page, pageCount - 1)
  const pagedGroups = visibleGroups.slice(
    visiblePage * ISSUE_GROUP_PAGE_SIZE,
    (visiblePage + 1) * ISSUE_GROUP_PAGE_SIZE
  )

  return (
    <section className="results-panel" aria-labelledby="results-heading">
      <div className="results-heading-row">
        <div>
          <div className="section-kicker">03 / 质检结果</div>
          <h2 id="results-heading" tabIndex={-1}>{errors > 0 ? '先处理阻止上架的问题' : '这批商品可以进入人工复核'}</h2>
          <p>{productCount} 条商品 · {errors} 个错误 · {warnings} 个警告</p>
        </div>
        <button type="button" className="export-button" onClick={onExport} disabled={exporting}>
          {exporting ? '正在生成…' : '导出 Excel 报告'}
          <span aria-hidden="true">↗</span>
        </button>
      </div>

      <div className="inspection-tape" role="status">
        <span className={errors > 0 ? 'inspection-tape__verdict inspection-tape__verdict--error' : 'inspection-tape__verdict inspection-tape__verdict--pass'}>
          {errors > 0 ? '需要修改' : '可以人工复核'}
        </span>
        <span>错误 <strong>{errors}</strong></span>
        <span>警告 <strong>{warnings}</strong></span>
        <span>已检查 <strong>{productCount}</strong></span>
      </div>

      <div className="result-tools">
        <div className="filter-tabs" role="group" aria-label="筛选问题级别">
          {([
            ['all', '全部', issues.length],
            ['error', '错误', errors],
            ['warning', '警告', warnings]
          ] as const).map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              className={filter === value ? 'is-active' : undefined}
              aria-pressed={filter === value}
              onClick={() => {
                setFilter(value)
                setPage(0)
              }}
            >
              {label} <span>{count}</span>
            </button>
          ))}
        </div>
        <label className="issue-search">
          <span className="visually-hidden">搜索问题</span>
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(0)
            }}
            placeholder="搜索 SKU、行号或问题"
          />
        </label>
      </div>

      {visibleIssues.length === 0 ? (
        <div className="results-empty">
          <strong>{issues.length === 0 ? '没有发现规则问题' : '没有匹配的问题'}</strong>
          <span>{issues.length === 0 ? '仍建议按目标平台要求完成人工复核。' : '清除筛选或更换关键词。'}</span>
        </div>
      ) : (
        <section className="issue-groups" aria-label="质检问题明细">
          <div className="issue-groups__intro">
            <strong>{visibleGroups.length} 个待复核对象</strong>
            <span>已按 SKU 和源表行合并，共 {visibleIssues.length} 条问题</span>
          </div>
          {pagedGroups.map((group) => (
            <article className="issue-group" key={group.key}>
              <header className="issue-group__header">
                <div>
                  <span>
                    {group.sourceRows.length === 0
                      ? '文件或图片包'
                      : `源表第 ${group.sourceRows.join('、')} 行`}
                  </span>
                  <strong>{group.sku || '文件级问题'}</strong>
                </div>
                <div className="issue-group__counts" aria-label={`${group.errors} 个错误，${group.warnings} 个警告`}>
                  {group.errors > 0 && <span className="issue-count issue-count--error">{group.errors} 错误</span>}
                  {group.warnings > 0 && <span className="issue-count issue-count--warning">{group.warnings} 警告</span>}
                </div>
              </header>
              <ul className="issue-list">
                {group.issues.map((issue) => {
                  const key = getIssueKey(issue)
                  const selected = selectedIssueKey === key
                  return (
                    <li className={`issue-item issue-item--${issue.severity} ${selected ? 'is-selected' : ''}`} key={key}>
                      <div className="issue-item__severity">
                        <span className={`severity-pill severity-pill--${issue.severity}`}>
                          {issue.severity === 'error' ? '阻止上架' : '人工复核'}
                        </span>
                      </div>
                      <div className="issue-item__body">
                        <strong className="issue-message">{issue.message}</strong>
                        <div className="issue-suggestion">
                          <span>怎么改</span>
                          <p>{issue.suggestion}</p>
                        </div>
                      </div>
                      <div className="issue-item__meta">
                        <span>{fieldName(issue)}</span>
                        <details>
                          <summary>技术详情</summary>
                          <code>{issue.ruleId} · {issue.code}</code>
                        </details>
                      </div>
                      <div className="issue-item__action">
                        {issue.sourceRow !== null ? (
                          <button
                            type="button"
                            className="locate-button"
                            aria-current={selected ? 'true' : undefined}
                            onClick={() => onLocate(issue)}
                          >
                            {selected ? '正在查看' : `定位到第 ${issue.sourceRow} 行`}
                          </button>
                        ) : (
                          <span>无需定位行</span>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </article>
          ))}
          {pageCount > 1 && (
            <div className="issue-pagination">
              <span>显示第 {visiblePage * ISSUE_GROUP_PAGE_SIZE + 1}–{Math.min((visiblePage + 1) * ISSUE_GROUP_PAGE_SIZE, visibleGroups.length)} 组，共 {visibleGroups.length} 组</span>
              <div>
                <button type="button" disabled={visiblePage === 0} onClick={() => setPage(visiblePage - 1)}>上一页</button>
                <span>{visiblePage + 1} / {pageCount}</span>
                <button type="button" disabled={visiblePage >= pageCount - 1} onClick={() => setPage(visiblePage + 1)}>下一页</button>
              </div>
            </div>
          )}
        </section>
      )}
    </section>
  )
}
