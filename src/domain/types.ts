export const CANONICAL_FIELDS = [
  'sku',
  'title',
  'price',
  'currency',
  'stock',
  'brand',
  'category'
] as const

export type CanonicalField = (typeof CANONICAL_FIELDS)[number]
export type CellValue = string | number | boolean | null

export interface RawRow {
  sourceRow: number
  values: Record<string, CellValue>
}

export interface ParsedSheet {
  name: string
  headers: string[]
  rows: RawRow[]
}

export interface ParsedWorkbook {
  fileName: string
  sheets: ParsedSheet[]
}

export type ColumnMapping = Partial<Record<CanonicalField, string>>

export interface CanonicalProduct {
  sku: CellValue
  title: CellValue
  price: CellValue
  currency: CellValue
  stock: CellValue
  brand: CellValue
  category: CellValue
  sourceRow: number
  raw: Record<string, CellValue>
}

export type Severity = 'error' | 'warning'

export interface RuleBase {
  id: string
  severity: Severity
  message?: string
  suggestion?: string
}

export interface RequiredRule extends RuleBase {
  type: 'required'
  field: CanonicalField
}

export interface UniqueRule extends RuleBase {
  type: 'unique'
  field: CanonicalField
  caseSensitive?: boolean
}

export interface LengthRule extends RuleBase {
  type: 'length'
  field: CanonicalField
  min?: number
  max?: number
}

export interface NumberRule extends RuleBase {
  type: 'number'
  field: CanonicalField
  min?: number
  max?: number
  integer?: boolean
}

export interface PatternRule extends RuleBase {
  type: 'pattern'
  field: CanonicalField
  pattern: string
  flags?: string
}

export interface ForbiddenTermsRule extends RuleBase {
  type: 'forbiddenTerms'
  fields: CanonicalField[]
  terms: string[]
  caseSensitive?: boolean
}

export interface EnumRule extends RuleBase {
  type: 'enum'
  field: CanonicalField
  values: string[]
  caseSensitive?: boolean
}

export interface ImageRule extends RuleBase {
  type: 'image'
  minCount?: number
  allowedExtensions?: string[]
  maxBytes?: number
  minWidth?: number
  minHeight?: number
}

export type LintRule =
  | RequiredRule
  | UniqueRule
  | LengthRule
  | NumberRule
  | PatternRule
  | ForbiddenTermsRule
  | EnumRule
  | ImageRule

export interface RulePack {
  schemaVersion: 1
  id: string
  name: string
  version: string
  description?: string
  fieldAliases: Partial<Record<CanonicalField, string[]>>
  rules: LintRule[]
}

export interface ImageAsset {
  name: string
  sku: string
  extension: string
  size: number
  width: number | null
  height: number | null
  decodeError?: string
}

export interface LintIssue {
  ruleId: string
  severity: Severity
  code: string
  message: string
  suggestion: string
  sku: string
  sourceRow: number | null
  field: CanonicalField | 'images' | 'file'
}
