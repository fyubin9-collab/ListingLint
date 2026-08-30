import JSZip from 'jszip'
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

function elementsByLocalName(parent: ParentNode, name: string): Element[] {
  return Array.from(parent.querySelectorAll('*')).filter((element) => element.localName === name)
}

function directChildren(parent: Element, name: string): Element[] {
  return Array.from(parent.children).filter((element) => element.localName === name)
}

function parseXml(xml: string): Document {
  const document = new DOMParser().parseFromString(xml, 'application/xml')
  if (elementsByLocalName(document, 'parsererror').length > 0) {
    throw new Error('Invalid XML')
  }
  return document
}

function resolveArchivePath(basePath: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1)
  const parts = [...basePath.split('/').slice(0, -1), ...target.split('/')]
  const resolved: string[] = []
  parts.forEach((part) => {
    if (!part || part === '.') return
    if (part === '..') resolved.pop()
    else resolved.push(part)
  })
  return resolved.join('/')
}

function columnIndex(reference: string): number {
  const letters = reference.match(/^[A-Z]+/i)?.[0].toUpperCase() ?? ''
  return [...letters].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0)
}

function descendantText(parent: Element, name: string): string {
  return elementsByLocalName(parent, name).map((element) => element.textContent ?? '').join('')
}

function readCell(cell: Element, sharedStrings: string[]): CellValue {
  const type = cell.getAttribute('t')
  const raw = directChildren(cell, 'v')[0]?.textContent ?? ''
  if (type === 'inlineStr') return descendantText(cell, 't') || null
  if (type === 's') return sharedStrings[Number(raw)] ?? null
  if (type === 'b') return raw === '1'
  if (type === 'str' || type === 'e' || type === 'd') return raw || null
  if (raw === '') return null
  const numeric = Number(raw)
  return Number.isFinite(numeric) ? numeric : raw
}

function parseWorksheet(xml: string, sheetName: string, sharedStrings: string[]): ParsedSheet {
  const document = parseXml(xml)
  const rowElements = elementsByLocalName(document, 'row')
  const rowsByNumber = new Map(
    rowElements.map((row, index) => [Number(row.getAttribute('r')) || index + 1, row] as const)
  )
  const headerRow = rowsByNumber.get(1)
  const headerCells = headerRow ? directChildren(headerRow, 'c') : []
  const headerByColumn = new Map(
    headerCells.map((cell) => [columnIndex(cell.getAttribute('r') ?? ''), readCell(cell, sharedStrings)] as const)
  )
  const columnCount = Math.max(0, ...Array.from(headerByColumn.keys()))
  const headers = ensureHeaders(
    Array.from({ length: columnCount }, (_, index) => String(headerByColumn.get(index + 1) ?? '')),
    sheetName
  )
  const rows: RawRow[] = []

  rowsByNumber.forEach((rowElement, rowNumber) => {
    if (rowNumber <= 1) return
    const cellByColumn = new Map(
      directChildren(rowElement, 'c').map((cell) => [
        columnIndex(cell.getAttribute('r') ?? ''),
        readCell(cell, sharedStrings)
      ] as const)
    )
    const values: Record<string, CellValue> = {}
    headers.forEach((header, index) => {
      values[header] = cellByColumn.get(index + 1) ?? null
    })
    const row = { sourceRow: rowNumber, values }
    if (!rowIsEmpty(row, headers)) rows.push(row)
  })

  if (rows.length > MAX_TABLE_ROWS) {
    throw new TableParseError(`工作表“${sheetName}”超过 ${MAX_TABLE_ROWS.toLocaleString()} 行上限。`)
  }
  return { name: sheetName, headers, rows }
}

async function parseXlsx(buffer: ArrayBuffer, fileName: string): Promise<ParsedWorkbook> {
  try {
    const archive = await JSZip.loadAsync(buffer)
    const workbookEntry = archive.file('xl/workbook.xml')
    const relationshipsEntry = archive.file('xl/_rels/workbook.xml.rels')
    if (!workbookEntry || !relationshipsEntry) throw new Error('Missing workbook metadata')

    const workbookDocument = parseXml(await workbookEntry.async('string'))
    const relationshipsDocument = parseXml(await relationshipsEntry.async('string'))
    const relationships = new Map(
      elementsByLocalName(relationshipsDocument, 'Relationship').map((relationship) => [
        relationship.getAttribute('Id') ?? '',
        relationship.getAttribute('Target') ?? ''
      ] as const)
    )
    const sharedStringsEntry = archive.file('xl/sharedStrings.xml')
    const sharedStrings = sharedStringsEntry
      ? elementsByLocalName(parseXml(await sharedStringsEntry.async('string')), 'si').map((item) =>
          descendantText(item, 't')
        )
      : []
    const parsedSheets: ParsedSheet[] = []
    let firstSheetError: TableParseError | null = null

    for (const sheet of elementsByLocalName(workbookDocument, 'sheet')) {
      const relationshipId = sheet.getAttribute('r:id') ?? sheet.getAttributeNS(
        'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
        'id'
      )
      const target = relationshipId ? relationships.get(relationshipId) : null
      const sheetEntry = target ? archive.file(resolveArchivePath('xl/workbook.xml', target)) : null
      if (!sheetEntry) continue
      try {
        parsedSheets.push(
          parseWorksheet(await sheetEntry.async('string'), sheet.getAttribute('name') ?? '未命名工作表', sharedStrings)
        )
      } catch (error) {
        if (error instanceof TableParseError && !firstSheetError) firstSheetError = error
        else if (!(error instanceof TableParseError)) throw error
      }
    }

    if (parsedSheets.length === 0) {
      if (firstSheetError) throw firstSheetError
      throw new TableParseError('XLSX 中没有可读取的工作表。')
    }
    return { fileName, sheets: parsedSheets }
  } catch (error) {
    if (error instanceof TableParseError) throw error
    throw new TableParseError('无法读取该 XLSX。文件可能已损坏、加密或不是有效的 Excel 工作簿。')
  }
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
