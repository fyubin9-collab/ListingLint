import { genericRulePack } from '../data/genericRulePack'
import { runLint } from './lintEngine'
import type { CanonicalProduct, ColumnMapping, ImageAsset, RulePack } from './types'

const mapping: ColumnMapping = {
  sku: 'SKU',
  title: 'Title',
  price: 'Price',
  currency: 'Currency',
  stock: 'Stock',
  brand: 'Brand',
  category: 'Category'
}

function product(overrides: Partial<CanonicalProduct> = {}): CanonicalProduct {
  return {
    sku: 'SKU-001',
    title: 'Portable stainless steel water bottle',
    price: 19.9,
    currency: 'USD',
    stock: 10,
    brand: 'Northstar',
    category: 'Outdoors',
    sourceRow: 2,
    raw: {},
    ...overrides
  }
}

function image(overrides: Partial<ImageAsset> = {}): ImageAsset {
  return {
    name: 'SKU-001_1.jpg',
    sku: 'SKU-001',
    extension: 'jpg',
    size: 500_000,
    width: 1600,
    height: 1600,
    ...overrides
  }
}

describe('lint engine', () => {
  it('returns no issues for a valid product and image', () => {
    expect(runLint({ products: [product()], mapping, rulePack: genericRulePack, images: [image()] })).toEqual([])
  })

  it('finds row, duplicate and image issues in deterministic order', () => {
    const products = [
      product({ sku: 'BAD SKU', title: 'short', price: 0, currency: 'usd', stock: 1.5, sourceRow: 5 }),
      product({ sku: 'bad sku', title: 'Best seller water bottle', sourceRow: 3 })
    ]
    const images = [
      image({ name: 'BAD SKU_1.gif', sku: 'BAD SKU', extension: 'gif', width: null, height: null }),
      image({ name: 'BAD SKU_2.jpg', sku: 'BAD SKU', extension: 'jpg', width: 500, height: 500 })
    ]
    const first = runLint({ products, mapping, rulePack: genericRulePack, images })
    const second = runLint({ products, mapping, rulePack: genericRulePack, images })

    expect(second).toEqual(first)
    expect(first.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'DUPLICATE',
        'PATTERN_MISMATCH',
        'TOO_SHORT',
        'NUMBER_TOO_SMALL',
        'NOT_INTEGER',
        'FORBIDDEN_TERM',
        'IMAGE_FORMAT',
        'IMAGE_TOO_SMALL'
      ])
    )
    expect(first.map((issue) => issue.sourceRow)).toEqual([...first.map((issue) => issue.sourceRow)].sort((a, b) => (a ?? -1) - (b ?? -1)))
  })

  it('emits one file-level issue for an unmapped required column and skips image checks when absent', () => {
    const issues = runLint({
      products: [product({ brand: null })],
      mapping: { ...mapping, brand: undefined },
      rulePack: genericRulePack,
      images: null
    })
    const missingBrand = issues.find((issue) => issue.code === 'MISSING_COLUMN' && issue.field === 'brand')
    expect(missingBrand?.message).toBe('必填字段“品牌”尚未映射。')
    expect(issues.filter((issue) => issue.code === 'IMAGE_CHECK_SKIPPED')).toHaveLength(1)
  })

  it('uses business-facing Chinese field names in issue explanations', () => {
    const issues = runLint({
      products: [product({ brand: null, stock: -1 })],
      mapping,
      rulePack: genericRulePack,
      images: [image()]
    })

    expect(issues.find((issue) => issue.field === 'brand')?.message).toBe('品牌不能为空。')
    expect(issues.find((issue) => issue.field === 'stock')?.message).toBe('库存不能小于 0。')
  })

  it('supports enum rules and identifies orphan or duplicate images', () => {
    const pack: RulePack = {
      ...genericRulePack,
      rules: [
        { id: 'currency.allowed', type: 'enum', field: 'currency', values: ['EUR'], severity: 'error' },
        genericRulePack.rules.find((rule) => rule.type === 'image')!
      ]
    }
    const images = [
      image(),
      image({ name: 'folder/SKU-001_1.jpg' }),
      image({ name: 'OTHER_1.jpg', sku: 'OTHER' })
    ]
    const issues = runLint({ products: [product()], mapping, rulePack: pack, images })
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['NOT_ALLOWED', 'DUPLICATE_IMAGE_NAME', 'ORPHAN_IMAGE'])
    )
  })

  it('checks 1,000 products and 300 images within the local performance budget', () => {
    const products = Array.from({ length: 1_000 }, (_, index) =>
      product({ sku: `SKU-${String(index).padStart(4, '0')}`, sourceRow: index + 2 })
    )
    const images = Array.from({ length: 300 }, (_, index) =>
      image({
        name: `SKU-${String(index).padStart(4, '0')}_1.jpg`,
        sku: `SKU-${String(index).padStart(4, '0')}`
      })
    )
    const startedAt = performance.now()
    const issues = runLint({ products, mapping, rulePack: genericRulePack, images })
    const elapsed = performance.now() - startedAt

    expect(issues.filter((issue) => issue.code === 'IMAGE_MISSING')).toHaveLength(700)
    expect(elapsed).toBeLessThan(1_000)
  })
})
