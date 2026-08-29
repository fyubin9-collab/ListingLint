import type { RulePack } from '../domain/types'

export const genericRulePack: RulePack = {
  schemaVersion: 1,
  id: 'generic-cross-border-v1',
  name: '通用跨境商品规则',
  version: '1.0.0',
  description: '演示性通用规则，不代表任何平台官方标准。',
  fieldAliases: {
    sku: ['SKU', 'Seller SKU', '商品编码', '商家编码', '货号'],
    title: ['Title', 'Product Title', '商品标题', '产品名称', '标题'],
    price: ['Price', 'Sale Price', '售价', '价格', '销售价'],
    currency: ['Currency', 'Currency Code', '币种', '货币'],
    stock: ['Stock', 'Quantity', 'Inventory', '库存', '可售库存'],
    brand: ['Brand', '品牌', '品牌名称'],
    category: ['Category', 'Product Type', '类目', '商品类目', '分类']
  },
  rules: [
    { id: 'required.sku', type: 'required', field: 'sku', severity: 'error' },
    { id: 'required.title', type: 'required', field: 'title', severity: 'error' },
    { id: 'required.price', type: 'required', field: 'price', severity: 'error' },
    { id: 'required.currency', type: 'required', field: 'currency', severity: 'error' },
    { id: 'required.stock', type: 'required', field: 'stock', severity: 'error' },
    { id: 'required.brand', type: 'required', field: 'brand', severity: 'error' },
    { id: 'required.category', type: 'required', field: 'category', severity: 'error' },
    {
      id: 'sku.unique',
      type: 'unique',
      field: 'sku',
      severity: 'error',
      caseSensitive: false
    },
    {
      id: 'sku.pattern',
      type: 'pattern',
      field: 'sku',
      severity: 'error',
      pattern: '^[A-Za-z0-9._-]{1,40}$',
      message: 'SKU 只能包含字母、数字、点、下划线或连字符，长度不超过 40。',
      suggestion: '使用稳定且不含空格的商家 SKU。'
    },
    {
      id: 'title.length',
      type: 'length',
      field: 'title',
      severity: 'error',
      min: 10,
      max: 200
    },
    {
      id: 'title.forbidden-terms',
      type: 'forbiddenTerms',
      fields: ['title'],
      severity: 'warning',
      terms: ['free shipping', 'best seller', '100% guaranteed'],
      caseSensitive: false,
      suggestion: '删除无法核实或可能受平台限制的宣传词，并按目标平台复核。'
    },
    { id: 'price.positive', type: 'number', field: 'price', severity: 'error', min: 0.01 },
    {
      id: 'currency.iso-like',
      type: 'pattern',
      field: 'currency',
      severity: 'error',
      pattern: '^[A-Z]{3}$',
      message: '币种应为三位大写代码，例如 USD、EUR。'
    },
    {
      id: 'stock.non-negative-integer',
      type: 'number',
      field: 'stock',
      severity: 'error',
      min: 0,
      integer: true
    },
    {
      id: 'images.basic',
      type: 'image',
      severity: 'error',
      minCount: 1,
      allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
      maxBytes: 10 * 1024 * 1024,
      minWidth: 1000,
      minHeight: 1000
    }
  ]
}
