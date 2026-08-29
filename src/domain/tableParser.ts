import ExcelJS from 'exceljs'
import Papa from 'papaparse'
import type { CellValue, ParsedSheet, ParsedWorkbook, RawRow } from './types'

export const MAX_TABLE_BYTES = 20 * 1024 * 1024
export const MAX_TABLE_ROWS = 5_000

export class TableParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TableParseError'
  }
}

function ensureHeaders(values: string[], sheetName: string): string[] {
  if (values.length === 0 || values.every((value) => value.trim() === '')) {
    throw new TableParseError(`工作表“${sheetName}”的第一行没有列名。`)
  }
  const headers = values.map((value, index) => {
    const header = value.trim()
    if (!header) throw new TableParseError(`工作表“${sheetName}”第 ${index + 1} 列缺少列名。`)
    return header
  })
  const normalized = headers.map((header) => header.toLocaleLowerCase())
  const duplicate = headers.find((_, index) => normalized.indexOf(normalized[index]) !== index)
  if (duplicate) {
    throw new TableParseError(`工作表“${sheetName}”存在重复列名“${duplicate}”。`)
  }
  return headers
}

function rowIsEmpty(row: RawRow, headers: string[]): boolean {
  return headers.every((header) => {
    const value = row.values[header]
    return value === null || String(value).trim() === ''
  })
}

function parseCsv(buffer: ArrayBuffer, fileName: string): ParsedWorkbook {
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    throw new TableParseError('CSV 不是有效的 UTF-8 编码，请另存为 UTF-8 或 UTF-8 BOM 后重试。')
  }

  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: 'greedy' })
  if (parsed.errors.length > 0) {
    const first = parsed.errors[0]
    throw new TableParseError(`CSV 第 ${first.row === undefined ? '?' : first.row + 1} 行解析失败：${first.message}`)
  }
  if (parsed.data.length === 0) throw new TableParseError('CSV 文件没有内容。')

  const headers = ensureHeaders(parsed.data[0].map(String), 'CSV')
  const rows = parsed.data.slice(1).map((values, index) => {
    const rowValues: Record<string, CellValue> = {}
    headers.forEach((header, columnIndex) => {
      const value = values[columnIndex]
      rowValues[header] = value === undefined || value === '' ? null : value
    })
    return { sourceRow: index + 2, values: rowValues }
  })
  const nonEmptyRows = rows.filter((row) => !rowIsEmpty(row, headers))
  if (nonEmptyRows.length > MAX_TABLE_ROWS) {
    throw new TableParseError(`商品数据超过 ${MAX_TABLE_ROWS.toLocaleString()} 行上限。`)
  }

  return { fileName, sheets: [{ name: 'CSV', headers, rows: nonEmptyRows }] }
}

function excelCellValue(cell: ExcelJS.Cell): CellValue {
  const value = cell.value
  if (value === null || value === undefined) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'object' && 'result' in value) {
    const result = value.result
    if (result === null || result === undefined) return cell.text || null
    if (typeof result === 'string' || typeof result === 'number' || typeof result === 'boolean') return result
  }
  return cell.text || null
}

function parseWorksheet(worksheet: ExcelJS.Worksheet): ParsedSheet {
  const columnCount = worksheet.actualColumnCount
  const headerValues = Array.from({ length: columnCount }, (_, index) => worksheet.getCell(1, index + 1).text)
  const headers = ensureHeaders(headerValues, worksheet.name)
  const rows: RawRow[] = []

  for (let rowNumber = 2; rowNumber <= worksheet.actualRowCount; rowNumber += 1) {
    const values: Record<string, CellValue> = {}
    headers.forEach((header, index) => {
      values[header] = excelCellValue(worksheet.getCell(rowNumber, index + 1))
    })
    const row = { sourceRow: rowNumber, values }
    if (!rowIsEmpty(row, headers)) rows.push(row)
  }

  if (rows.length > MAX_TABLE_ROWS) {
    throw new TableParseError(`工作表“${worksheet.name}”超过 ${MAX_TABLE_ROWS.toLocaleString()} 行上限。`)
  }
  return { name: worksheet.name, headers, rows }
}

async function parseXlsx(buffer: ArrayBuffer, fileName: string): Promise<ParsedWorkbook> {
  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(buffer)
  } catch {
    throw new TableParseError('无法读取该 XLSX。文件可能已损坏、加密或不是有效的 Excel 工作簿。')
  }
  const nonEmptyWorksheets = workbook.worksheets.filter((sheet) => sheet.actualRowCount > 0)
  if (nonEmptyWorksheets.length === 0) throw new TableParseError('XLSX 中没有可读取的工作表。')
  return { fileName, sheets: nonEmptyWorksheets.map(parseWorksheet) }
}

export async function parseTableFile(file: File): Promise<ParsedWorkbook> {
  if (file.size > MAX_TABLE_BYTES) {
    throw new TableParseError('商品表超过 20MB 上限，请拆分后重试。')
  }
  if (file.size === 0) throw new TableParseError('文件为空。')
  const extension = file.name.split('.').pop()?.toLocaleLowerCase()
  if (extension !== 'csv' && extension !== 'xlsx') {
    throw new TableParseError('仅支持 .csv 和 .xlsx 商品表。')
  }
  const buffer = await file.arrayBuffer()
  return extension === 'csv' ? parseCsv(buffer, file.name) : parseXlsx(buffer, file.name)
}
