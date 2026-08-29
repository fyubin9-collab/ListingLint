import { useMemo, useState } from 'react'
import type { ColumnMapping, LintIssue, ParsedSheet } from '../domain/types'

interface DataPreviewProps {
  sheet: ParsedSheet | null
  mapping: ColumnMapping
  issues: LintIssue[] | null
  selectedRow: number | null
  scanning: boolean
  onClearSelection: () => void
}

const PAGE_SIZE = 12

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

export function DataPreview({ sheet, mapping, issues, selectedRow, scanning, onClearSelection }: DataPreviewProps) {
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
    <div className="sheet-table-wrap" id="data-preview">
      {scanning && <div className="scan-line" aria-hidden="true" />}
      <table className="sheet-table">
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
              <tr key={row.sourceRow} className={selectedRow === row.sourceRow ? 'is-selected' : undefined}>
                <th className="row-number-cell" scope="row">{row.sourceRow}</th>
                <td className="row-status-cell">
                  {currentIssues.length > 0 ? (
                    <span
                      className={`row-status-dot ${hasError ? 'row-status-dot--error' : 'row-status-dot--warning'}`}
                      title={`${currentIssues.length} 个问题${hasWarning && hasError ? '，含警告' : ''}`}
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
                  return (
                    <td className={cellState} key={header} title={cellIssues.map((issue) => issue.message).join('\n')}>
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
