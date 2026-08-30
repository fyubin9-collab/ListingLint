import { useMemo, useState } from 'react'
import type { LintIssue } from '../domain/types'

type IssueFilter = 'all' | 'error' | 'warning'
const ISSUE_PAGE_SIZE = 50

interface ResultsPanelProps {
  issues: LintIssue[]
  productCount: number
  onLocate: (sourceRow: number) => void
  onExport: () => void
  exporting: boolean
}

export function ResultsPanel({ issues, productCount, onLocate, onExport, exporting }: ResultsPanelProps) {
  const [filter, setFilter] = useState<IssueFilter>('all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const errors = issues.filter((issue) => issue.severity === 'error').length
  const warnings = issues.filter((issue) => issue.severity === 'warning').length

  const visibleIssues = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return issues.filter((issue) => {
      if (filter !== 'all' && issue.severity !== filter) return false
      if (!normalizedQuery) return true
      return [issue.sku, issue.code, issue.ruleId, issue.message, issue.suggestion, String(issue.sourceRow ?? '')]
        .join(' ')
        .toLocaleLowerCase()
        .includes(normalizedQuery)
    })
  }, [filter, issues, query])
  const pageCount = Math.max(1, Math.ceil(visibleIssues.length / ISSUE_PAGE_SIZE))
  const visiblePage = Math.min(page, pageCount - 1)
  const pagedIssues = visibleIssues.slice(
    visiblePage * ISSUE_PAGE_SIZE,
    (visiblePage + 1) * ISSUE_PAGE_SIZE
  )

  return (
    <section className="results-panel" aria-labelledby="results-heading">
      <div className="results-heading-row">
        <div>
          <div className="section-kicker">03 / 质检结果</div>
          <h2 id="results-heading">{errors > 0 ? '先处理阻止上架的问题' : '这批商品可以进入人工复核'}</h2>
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
        <div className="issue-table-wrap">
          <table className="issue-table" aria-label="质检问题明细">
            <thead>
              <tr>
                <th>级别</th>
                <th>位置</th>
                <th>SKU</th>
                <th>问题与建议</th>
                <th>规则</th>
                <th><span className="visually-hidden">操作</span></th>
              </tr>
            </thead>
            <tbody>
              {pagedIssues.map((issue, index) => (
                <tr key={`${issue.ruleId}-${issue.sourceRow ?? 'file'}-${issue.field}-${index}`}>
                  <td><span className={`severity-pill severity-pill--${issue.severity}`}>{issue.severity === 'error' ? '错误' : '警告'}</span></td>
                  <td className="mono-cell">{issue.sourceRow === null ? '文件' : `第 ${issue.sourceRow} 行`}<small>{issue.field}</small></td>
                  <td className="mono-cell">{issue.sku || '—'}</td>
                  <td><strong>{issue.message}</strong><small>{issue.suggestion}</small></td>
                  <td className="mono-cell">{issue.ruleId}<small>{issue.code}</small></td>
                  <td>
                    {issue.sourceRow !== null && (
                      <button type="button" className="locate-button" onClick={() => onLocate(issue.sourceRow!)}>
                        定位
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pageCount > 1 && (
            <div className="issue-pagination">
              <span>显示 {visiblePage * ISSUE_PAGE_SIZE + 1}–{Math.min((visiblePage + 1) * ISSUE_PAGE_SIZE, visibleIssues.length)} / {visibleIssues.length}</span>
              <div>
                <button type="button" disabled={visiblePage === 0} onClick={() => setPage(visiblePage - 1)}>上一页</button>
                <span>{visiblePage + 1} / {pageCount}</span>
                <button type="button" disabled={visiblePage >= pageCount - 1} onClick={() => setPage(visiblePage + 1)}>下一页</button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
