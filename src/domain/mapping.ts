import type {
  CanonicalField,
  CanonicalProduct,
  ColumnMapping,
  ParsedSheet,
  RulePack
} from './types'
import { CANONICAL_FIELDS } from './types'

export const FIELD_LABELS: Record<CanonicalField, string> = {
  sku: 'SKU',
  title: 'Title 商品标题',
  price: 'Price 价格',
  currency: 'Currency 币种',
  stock: 'Stock 库存',
  brand: 'Brand 品牌',
  category: 'Category 类目'
}

function normalizeHeader(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase()
    .replace(/[\s_\-()[\]（）【】]+/g, '')
}

export function suggestMapping(headers: string[], pack: RulePack): ColumnMapping {
  const normalizedHeaders = headers.map((header) => ({
    header,
    normalized: normalizeHeader(header)
  }))
  const used = new Set<string>()
  const mapping: ColumnMapping = {}

  CANONICAL_FIELDS.forEach((field) => {
    const candidates = [field, ...(pack.fieldAliases[field] ?? [])].map(normalizeHeader)
    const match = normalizedHeaders.find(
      (header) => !used.has(header.header) && candidates.includes(header.normalized)
    )
    if (match) {
      mapping[field] = match.header
      used.add(match.header)
    }
  })

  return mapping
}

export function mapProducts(sheet: ParsedSheet, mapping: ColumnMapping): CanonicalProduct[] {
  return sheet.rows.map((row) => ({
    sku: mapping.sku ? row.values[mapping.sku] ?? null : null,
    title: mapping.title ? row.values[mapping.title] ?? null : null,
    price: mapping.price ? row.values[mapping.price] ?? null : null,
    currency: mapping.currency ? row.values[mapping.currency] ?? null : null,
    stock: mapping.stock ? row.values[mapping.stock] ?? null : null,
    brand: mapping.brand ? row.values[mapping.brand] ?? null : null,
    category: mapping.category ? row.values[mapping.category] ?? null : null,
    sourceRow: row.sourceRow,
    raw: row.values
  }))
}

export function getDuplicateMappedHeaders(mapping: ColumnMapping): string[] {
  const counts = new Map<string, number>()
  Object.values(mapping).forEach((header) => {
    if (header) counts.set(header, (counts.get(header) ?? 0) + 1)
  })
  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([header]) => header)
}
