import { useMemo, useState } from 'react'
import type { ColumnMapping, LintIssue, ParsedSheet } from '../domain/types'
import { getIssueKey } from '../domain/issues'

interface DataPreviewProps {
  sheet: ParsedSheet | null
  mapping: ColumnMapping
  issues: LintIssue[] | null
  selectedRow: number | null
  selectedIssue: LintIssue | null
  scanning: boolean
  onClearSelection: () => void
}

const PAGE_SIZE = 12

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

export function DataPreview({ sheet, mapping, issues, selectedRow, selectedIssue, scanning, onClearSelection }: DataPreviewProps) {
  const [page, setPage] = useState(0)
  const pageCount = sheet ? Math.max(1, Math.ceil(sheet.rows.length / PAGE_SIZE)) : 1
  const selectedIndex = sheet && selectedRow !== null
    ? sheet.rows.findIndex((row) => row.sourceRow === selectedRow)
    : -1
  const selectedPage = selectedIndex >= 0 ? Math.floor(selectedIndex / PAGE_SIZE) : null
  const visiblePage = Math.min(selectedPage ?? page, pageCount - 1)

  const rowIssues = useMemo(() => {
    const map = new Map<number, LintIssue[]>()
    issues?.forEach((issue) => {
      if (issue.sourceRow !== null) map.set(issue.sourceRow, [...(map.get(issue.sourceRow) ?? []), issue])
    })
    return map
  }, [issues])
  const fieldsByHeader = useMemo(() => {
    const map = new Map<string, string[]>()
    Object.entries(mapping).forEach(([field, header]) => {
      if (header) map.set(header, [...(map.get(header) ?? []), field])
    })
    return map
  }, [mapping])

  const rows = sheet?.rows.slice(visiblePage * PAGE_SIZE, (visiblePage + 1) * PAGE_SIZE) ?? []

  if (!sheet) {
    return (
      <div className="sheet-empty">
        <div className="empty-sheet-icon" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <h2>商品表会在这里展开</h2>
        <p>先在左侧选择文件，或载入内置示例体验完整质检流程。</p>
      </div>
    )
  }

  return (
    <div className="sheet-table-wrap" id="data-preview" tabIndex={0} aria-label="可横向滚动的商品数据预览">
      {scanning && <div className="scan-line" aria-hidden="true" />}
      <table className="sheet-table" aria-label="商品数据预览">
        <caption className="visually-hidden">商品数据预览；有问题的行和单元格会显示错误或警告状态。</caption>
        <thead>
          <tr>
            <th className="row-number-cell">行</th>
            <th className="row-status-cell"><span className="visually-hidden">状态</span></th>
            {sheet.headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const currentIssues = rowIssues.get(row.sourceRow) ?? []
            const hasError = currentIssues.some((issue) => issue.severity === 'error')
            const hasWarning = currentIssues.some((issue) => issue.severity === 'warning')
            return (
              <tr
                id={`data-row-${row.sourceRow}`}
                key={row.sourceRow}
                className={selectedRow === row.sourceRow ? 'is-selected' : undefined}
                aria-selected={selectedRow === row.sourceRow || undefined}
              >
                <th className="row-number-cell" scope="row">{row.sourceRow}</th>
                <td className="row-status-cell">
                  {currentIssues.length > 0 ? (
                    <span
                      className={`row-status-dot ${hasError ? 'row-status-dot--error' : 'row-status-dot--warning'}`}
                      title={`${currentIssues.length} 个问题${hasWarning && hasError ? '，含警告' : ''}`}
                      aria-label={`本行有 ${currentIssues.length} 个问题${hasWarning && hasError ? '，包含错误和警告' : hasError ? '，包含错误' : '，包含警告'}`}
                    >
                      {currentIssues.length}
                    </span>
                  ) : issues ? <span className="row-status-pass" title="本行通过">✓</span> : <span className="row-status-pending">·</span>}
                </td>
                {sheet.headers.map((header) => {
                  const canonicalFields = fieldsByHeader.get(header) ?? []
                  const cellIssues = currentIssues.filter((issue) => canonicalFields.includes(issue.field))
                  const cellState = cellIssues.some((issue) => issue.severity === 'error')
                    ? 'cell--error'
                    : cellIssues.length > 0
                      ? 'cell--warning'
                      : ''
                  const isSelectedCell = selectedIssue
                    ? selectedIssue.sourceRow === row.sourceRow && cellIssues.some((issue) => getIssueKey(issue) === getIssueKey(selectedIssue))
                    : false
                  return (
                    <td
                      className={`${cellState} ${isSelectedCell ? 'cell--selected' : ''}`.trim() || undefined}
                      key={header}
                      title={cellIssues.map((issue) => issue.message).join('\n')}
                      aria-describedby={isSelectedCell ? 'issue-review-panel' : undefined}
                      aria-label={cellIssues.length > 0
                        ? `${displayValue(row.values[header])}；${cellIssues.map((issue) => issue.message).join('；')}`
                        : undefined}
                    >
                      {displayValue(row.values[header])}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="sheet-pagination">
        <span>第 {visiblePage * PAGE_SIZE + 1}–{Math.min((visiblePage + 1) * PAGE_SIZE, sheet.rows.length)} 行，共 {sheet.rows.length} 行</span>
        <div>
          <button
            type="button"
            disabled={visiblePage === 0}
            onClick={() => {
              onClearSelection()
              setPage(visiblePage - 1)
            }}
            aria-label="上一页"
          >←</button>
          <span>{visiblePage + 1} / {pageCount}</span>
          <button
            type="button"
            disabled={visiblePage >= pageCount - 1}
            onClick={() => {
              onClearSelection()
              setPage(visiblePage + 1)
            }}
            aria-label="下一页"
          >→</button>
        </div>
      </div>
    </div>
  )
}
