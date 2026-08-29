import { genericRulePack } from './genericRulePack'
import { demoCsv, demoImages, demoWorkbook } from './demo'
import { runLint } from '../domain/lintEngine'
import { mapProducts, suggestMapping } from '../domain/mapping'
import downloadableDemoCsv from '../../examples/listinglint-demo.csv?raw'

describe('built-in demo', () => {
  it('keeps the downloadable CSV example in sync with the built-in walkthrough', () => {
    expect(downloadableDemoCsv.trim()).toBe(demoCsv.trim())
  })

  it('contains both errors and warnings for an immediate product walkthrough', () => {
    const sheet = demoWorkbook.sheets[0]
    const mapping = suggestMapping(sheet.headers, genericRulePack)
    const issues = runLint({
      products: mapProducts(sheet, mapping),
      mapping,
      rulePack: genericRulePack,
      images: demoImages
    })

    expect(issues.some((issue) => issue.severity === 'error')).toBe(true)
    expect(issues.some((issue) => issue.severity === 'warning')).toBe(true)
    expect(issues.some((issue) => issue.code === 'DUPLICATE')).toBe(true)
    expect(issues.some((issue) => issue.code === 'IMAGE_TOO_SMALL')).toBe(true)
  })
})
