import ExcelJS from 'exceljs'
import type { ColumnMapping, LintIssue, RulePack } from './types'
import { FIELD_LABELS } from './mapping'

export interface ReportInput {
  sourceName: string
  productCount: number
  issues: LintIssue[]
  mapping: ColumnMapping
  rulePack: RulePack
  generatedAt?: Date
}

const COLORS = {
  ink: 'FF14213D',
  paper: 'FFF7F8F2',
  blue: 'FF2557D6',
  amber: 'FFF6B73C',
  red: 'FFD64545',
  teal: 'FF0F8B8D',
  white: 'FFFFFFFF',
  grid: 'FFD9DED7'
}

function styleTitle(sheet: ExcelJS.Worksheet, title: string, endColumn: string): void {
  sheet.mergeCells(`A1:${endColumn}1`)
  const cell = sheet.getCell('A1')
  cell.value = title
  cell.font = { name: 'Microsoft YaHei', size: 18, bold: true, color: { argb: COLORS.white } }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.ink } }
  cell.alignment = { vertical: 'middle', horizontal: 'left' }
  sheet.getRow(1).height = 34
}

function styleHeader(row: ExcelJS.Row): void {
  row.font = { name: 'Microsoft YaHei', bold: true, color: { argb: COLORS.white } }
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.blue } }
  row.alignment = { vertical: 'middle' }
  row.height = 24
}

function addBorders(sheet: ExcelJS.Worksheet, fromRow: number, toRow: number, toColumn: number): void {
  for (let row = fromRow; row <= toRow; row += 1) {
    for (let column = 1; column <= toColumn; column += 1) {
      sheet.getCell(row, column).border = {
        bottom: { style: 'hair', color: { argb: COLORS.grid } }
      }
    }
  }
}

function ruleDescription(rule: RulePack['rules'][number]): string {
  if (rule.type === 'image') return `图片：至少 ${rule.minCount ?? 0} 张，最小 ${rule.minWidth ?? '-'}×${rule.minHeight ?? '-'}px`
  if (rule.type === 'forbiddenTerms') return `${rule.fields.join(', ')} 禁用词：${rule.terms.join(', ')}`
  if (rule.type === 'enum') return `${rule.field} 允许值：${rule.values.join(', ')}`
  if (rule.type === 'pattern') return `${rule.field} 匹配 /${rule.pattern}/${rule.flags ?? ''}`
  if (rule.type === 'length') return `${rule.field} 长度 ${rule.min ?? '-'}–${rule.max ?? '-'}`
  if (rule.type === 'number') return `${rule.field} 数值 ${rule.min ?? '-∞'}–${rule.max ?? '∞'}${rule.integer ? '，整数' : ''}`
  return `${rule.field} ${rule.type === 'required' ? '必填' : '唯一'}`
}

export async function buildReportBuffer(input: ReportInput): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'ListingLint'
  workbook.created = input.generatedAt ?? new Date()
  workbook.subject = '电商商品上架质检报告'

  const errors = input.issues.filter((issue) => issue.severity === 'error').length
  const warnings = input.issues.filter((issue) => issue.severity === 'warning').length
  const summary = workbook.addWorksheet('概览', { views: [{ state: 'frozen', ySplit: 1 }] })
  styleTitle(summary, 'ListingLint 上架质检报告', 'D')
  summary.columns = [
    { width: 20 },
    { width: 34 },
    { width: 20 },
    { width: 34 }
  ]
  const generatedAt = input.generatedAt ?? new Date()
  const summaryRows: Array<[string, string | number, string, string | number]> = [
    ['源文件', input.sourceName, '检查商品数', input.productCount],
    ['规则包', input.rulePack.name, '规则版本', input.rulePack.version],
    ['生成时间', generatedAt.toISOString(), '结论', errors > 0 ? '需要修改' : '可以发布'],
    ['错误 Errors', errors, '警告 Warnings', warnings]
  ]
  summaryRows.forEach((values) => summary.addRow(values))
  for (let rowNumber = 2; rowNumber <= 5; rowNumber += 1) {
    for (const columnNumber of [1, 3]) {
      summary.getCell(rowNumber, columnNumber).font = {
        name: 'Microsoft YaHei',
        bold: true,
        color: { argb: COLORS.ink }
      }
    }
  }
  summary.getCell('B5').font = { bold: true, color: { argb: errors > 0 ? COLORS.red : COLORS.teal } }
  summary.mergeCells('A7:D7')
  summary.getCell('A7').value = input.rulePack.description ?? ''
  summary.getCell('A7').font = { name: 'Microsoft YaHei', italic: true, color: { argb: COLORS.ink } }
  summary.getCell('A7').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.paper } }
  summary.getCell('A7').alignment = { wrapText: true, vertical: 'middle' }
  summary.getRow(7).height = 30
  addBorders(summary, 2, 5, 4)

  const issueSheet = workbook.addWorksheet('问题明细', { views: [{ state: 'frozen', ySplit: 2 }] })
  styleTitle(issueSheet, '问题明细｜按源行定位', 'I')
  issueSheet.columns = [
    { key: 'severity', width: 12 },
    { key: 'sourceRow', width: 12 },
    { key: 'sku', width: 20 },
    { key: 'field', width: 18 },
    { key: 'ruleId', width: 28 },
    { key: 'code', width: 24 },
    { key: 'message', width: 48 },
    { key: 'suggestion', width: 52 },
    { key: 'status', width: 14 }
  ]
  issueSheet.addRow(['级别', '源表行号', 'SKU', '字段', '规则编号', '问题代码', '原因', '修改建议', '处理状态'])
  styleHeader(issueSheet.getRow(2))
  input.issues.forEach((issue) => {
    const row = issueSheet.addRow([
      issue.severity === 'error' ? '错误' : '警告',
      issue.sourceRow ?? '',
      issue.sku,
      issue.field,
      issue.ruleId,
      issue.code,
      issue.message,
      issue.suggestion,
      '待处理'
    ])
    row.getCell(1).font = { bold: true, color: { argb: issue.severity === 'error' ? COLORS.red : 'FF9A6500' } }
    row.alignment = { vertical: 'top', wrapText: true }
  })
  issueSheet.autoFilter = { from: 'A2', to: 'I2' }
  addBorders(issueSheet, 3, Math.max(3, issueSheet.rowCount), 9)

  const configSheet = workbook.addWorksheet('字段映射与规则', { views: [{ state: 'frozen', ySplit: 2 }] })
  styleTitle(configSheet, '字段映射与规则', 'D')
  configSheet.columns = [
    { width: 26 },
    { width: 34 },
    { width: 18 },
    { width: 64 }
  ]
  configSheet.addRow(['标准字段', '源表列', '状态', '说明'])
  styleHeader(configSheet.getRow(2))
  Object.entries(FIELD_LABELS).forEach(([field, label]) => {
    const mapped = input.mapping[field as keyof ColumnMapping]
    configSheet.addRow([label, mapped ?? '', mapped ? '已映射' : '未映射', ''])
  })
  const rulesStart = configSheet.rowCount + 2
  configSheet.getCell(`A${rulesStart}`).value = '规则编号'
  configSheet.getCell(`B${rulesStart}`).value = '级别'
  configSheet.getCell(`C${rulesStart}`).value = '类型'
  configSheet.getCell(`D${rulesStart}`).value = '规则内容'
  styleHeader(configSheet.getRow(rulesStart))
  input.rulePack.rules.forEach((rule) => {
    configSheet.addRow([rule.id, rule.severity, rule.type, ruleDescription(rule)])
  })
  addBorders(configSheet, 3, configSheet.rowCount, 4)

  workbook.eachSheet((sheet) => {
    sheet.properties.defaultRowHeight = 20
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) row.font = { ...row.font, name: 'Microsoft YaHei', size: 10 }
    })
    sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  })

  const rawBuffer = await workbook.xlsx.writeBuffer()
  const bytes = rawBuffer instanceof ArrayBuffer
    ? new Uint8Array(rawBuffer)
    : new Uint8Array(rawBuffer as unknown as ArrayLike<number>)
  return bytes.slice().buffer
}

export async function downloadReport(input: ReportInput): Promise<void> {
  const buffer = await buildReportBuffer(input)
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'listinglint-report.xlsx'
  anchor.click()
  URL.revokeObjectURL(url)
}
