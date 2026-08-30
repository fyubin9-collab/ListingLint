import fs from 'node:fs/promises'
import ExcelJS from 'exceljs'
import JSZip from 'jszip'

const [sourcePath, outputPath = sourcePath] = process.argv.slice(2)

if (!sourcePath) {
  throw new Error('Usage: node scripts/normalize-template-xlsx.mjs <source.xlsx> [output.xlsx]')
}

const archive = await JSZip.loadAsync(await fs.readFile(sourcePath))
const spreadsheetXml = Object.keys(archive.files).filter(
  (path) =>
    path === 'xl/workbook.xml' ||
    path === 'xl/styles.xml' ||
    path === 'xl/sharedStrings.xml' ||
    path.startsWith('xl/worksheets/')
)

for (const path of spreadsheetXml) {
  const entry = archive.file(path)
  if (!entry) continue
  const xml = await entry.async('string')
  archive.file(
    path,
    xml.replace('xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"',
      'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"')
      .replace(/<(\/?)[x]:/g, '<$1')
  )
}

const normalized = await archive.generateAsync({ type: 'nodebuffer' })
const workbook = new ExcelJS.Workbook()
await workbook.xlsx.load(normalized)

const productSheet = workbook.getWorksheet('商品数据')
if (productSheet) {
  const lastStyledRow = 51
  if (productSheet.rowCount > lastStyledRow) {
    productSheet.spliceRows(lastStyledRow + 1, productSheet.rowCount - lastStyledRow)
    productSheet._rows.length = lastStyledRow
  }

  productSheet.dataValidations.model = {}
  productSheet.dataValidations.add('C2:C51', {
    type: 'decimal',
    operator: 'greaterThan',
    formulae: [0]
  })
  productSheet.dataValidations.add('D2:D51', {
    type: 'list',
    formulae: ['"USD,EUR,GBP,JPY,AUD,CAD,CNY,HKD,SGD"']
  })
  productSheet.dataValidations.add('E2:E51', {
    type: 'whole',
    operator: 'greaterThanOrEqual',
    formulae: [0]
  })
  productSheet.removeConditionalFormatting()
  productSheet.addConditionalFormatting({
    ref: 'A2:A51',
    rules: [
      {
        type: 'expression',
        formulae: ['AND(A2<>"",COUNTIF($A$2:$A$51,A2)>1)'],
        style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFDADA' } } }
      }
    ]
  })
}

await fs.writeFile(outputPath, Buffer.from(await workbook.xlsx.writeBuffer()))
