import ExcelJS from 'exceljs'
import { parseTableFile, TableParseError } from './tableParser'

describe('table parser', () => {
  it('parses UTF-8 BOM CSV and preserves source row numbers', async () => {
    const file = new File(
      ['\uFEFFSKU,商品标题,售价\r\nA-1,Useful product title,12.50\r\nA-2,,9.90'],
      'products.csv',
      { type: 'text/csv' }
    )
    const workbook = await parseTableFile(file)
    expect(workbook.sheets[0].headers).toEqual(['SKU', '商品标题', '售价'])
    expect(workbook.sheets[0].rows).toHaveLength(2)
    expect(workbook.sheets[0].rows[1].sourceRow).toBe(3)
    expect(workbook.sheets[0].rows[1].values['商品标题']).toBeNull()
  })

  it('rejects duplicate headers', async () => {
    const file = new File(['SKU,sku\nA-1,A-2'], 'duplicates.csv', { type: 'text/csv' })
    await expect(parseTableFile(file)).rejects.toThrow(TableParseError)
  })

  it('rejects unsupported extensions and empty files', async () => {
    await expect(parseTableFile(new File(['x'], 'products.xls'))).rejects.toThrow('仅支持')
    await expect(parseTableFile(new File([], 'products.csv'))).rejects.toThrow('文件为空')
  })

  it('parses multiple XLSX worksheets and keeps typed values', async () => {
    const source = new ExcelJS.Workbook()
    const products = source.addWorksheet('Products')
    products.addRow(['SKU', 'Title', 'Price'])
    products.addRow(['A-1', 'Useful product title', 12.5])
    const archive = source.addWorksheet('Archive')
    archive.addRow(['SKU', 'Stock'])
    archive.addRow(['OLD-1', 0])
    const raw = await source.xlsx.writeBuffer()
    const bytes = new Uint8Array(raw as ArrayBuffer)
    const file = new File([bytes.slice().buffer], 'products.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })

    const workbook = await parseTableFile(file)
    expect(workbook.sheets.map((sheet) => sheet.name)).toEqual(['Products', 'Archive'])
    expect(workbook.sheets[0].rows[0].values.Price).toBe(12.5)
    expect(workbook.sheets[1].rows[0].values.Stock).toBe(0)
  })

  it('rejects invalid UTF-8 and corrupted XLSX input', async () => {
    const invalidUtf8 = new File([new Uint8Array([0xff, 0xfe, 0xfd]).buffer], 'bad.csv')
    await expect(parseTableFile(invalidUtf8)).rejects.toThrow('UTF-8')
    await expect(parseTableFile(new File(['not xlsx'], 'bad.xlsx'))).rejects.toThrow('无法读取')
  })
})
