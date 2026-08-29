import { genericRulePack } from '../data/genericRulePack'
import { getDuplicateMappedHeaders, mapProducts, suggestMapping } from './mapping'
import type { ParsedSheet } from './types'

describe('field mapping', () => {
  it('recognizes common Chinese and English aliases without reusing columns', () => {
    const mapping = suggestMapping(
      ['Seller SKU', '商品标题', '售价', 'Currency Code', '库存', '品牌名称', '商品类目'],
      genericRulePack
    )

    expect(mapping).toEqual({
      sku: 'Seller SKU',
      title: '商品标题',
      price: '售价',
      currency: 'Currency Code',
      stock: '库存',
      brand: '品牌名称',
      category: '商品类目'
    })
  })

  it('maps rows without changing source values', () => {
    const sheet: ParsedSheet = {
      name: 'Products',
      headers: ['SKU', 'Title'],
      rows: [{ sourceRow: 2, values: { SKU: 'A-1', Title: 'Demo title' } }]
    }
    const products = mapProducts(sheet, { sku: 'SKU', title: 'Title' })
    expect(products[0].sku).toBe('A-1')
    expect(products[0].sourceRow).toBe(2)
    expect(sheet.rows[0].values).toEqual({ SKU: 'A-1', Title: 'Demo title' })
  })

  it('reports duplicate manual mappings', () => {
    expect(getDuplicateMappedHeaders({ sku: 'Code', title: 'Code', price: 'Price' })).toEqual(['Code'])
  })
})
