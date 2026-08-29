import ExcelJS from 'exceljs'
import { genericRulePack } from '../data/genericRulePack'
import { buildReportBuffer } from './report'
import type { ColumnMapping, LintIssue } from './types'

const mapping: ColumnMapping = {
  sku: 'SKU',
  title: 'Title',
  price: 'Price',
  currency: 'Currency',
  stock: 'Stock',
  brand: 'Brand',
  category: 'Category'
}

const issue: LintIssue = {
  ruleId: 'required.brand',
  severity: 'error',
  code: 'REQUIRED',
  message: 'brand 不能为空。',
  suggestion: '补充该字段后再上架。',
  sku: 'SKU-1',
  sourceRow: 3,
  field: 'brand'
}

describe('Excel report', () => {
  it('creates the required sheets with UI-equivalent issue details', async () => {
    const buffer = await buildReportBuffer({
      sourceName: 'products.csv',
      productCount: 2,
      issues: [issue],
      mapping,
      rulePack: genericRulePack,
      generatedAt: new Date('2026-08-30T00:00:00.000Z')
    })
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['概览', '问题明细', '字段映射与规则'])
    expect(workbook.getWorksheet('概览')?.getCell('A1').value).toBe('ListingLint 上架质检报告')
    expect(workbook.getWorksheet('概览')?.getCell('A1').font.color).toEqual({ argb: 'FFFFFFFF' })
    expect(workbook.getWorksheet('概览')?.getCell('B2').value).toBe('products.csv')
    expect(workbook.getWorksheet('问题明细')?.getCell('C3').value).toBe('SKU-1')
    expect(workbook.getWorksheet('问题明细')?.getCell('G3').value).toBe(issue.message)
    expect(workbook.getWorksheet('字段映射与规则')?.getCell('B3').value).toBe('SKU')
  })
})
