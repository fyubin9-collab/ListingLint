import type {
  CanonicalField,
  CanonicalProduct,
  ColumnMapping,
  ImageAsset,
  LintIssue,
  LintRule,
  RulePack
} from './types'
import { FIELD_NAMES } from './mapping'

export interface LintInput {
  products: CanonicalProduct[]
  mapping: ColumnMapping
  rulePack: RulePack
  images: ImageAsset[] | null
}

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === ''
}

function stringValue(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim()
}

function baseIssue(
  rule: LintRule,
  product: CanonicalProduct | null,
  field: CanonicalField | 'images' | 'file',
  code: string,
  message: string,
  suggestion: string
): LintIssue {
  return {
    ruleId: rule.id,
    severity: rule.severity,
    code,
    message: rule.message ?? message,
    suggestion: rule.suggestion ?? suggestion,
    sku: product ? stringValue(product.sku) : '',
    sourceRow: product?.sourceRow ?? null,
    field
  }
}

function issueForValueRule(rule: Exclude<LintRule, { type: 'image' | 'forbiddenTerms' }>, product: CanonicalProduct): LintIssue | null {
  const value = product[rule.field]
  const fieldName = FIELD_NAMES[rule.field]
  if (rule.type !== 'required' && isEmpty(value)) return null

  if (rule.type === 'required' && isEmpty(value)) {
    return baseIssue(rule, product, rule.field, 'REQUIRED', `${fieldName}不能为空。`, `补充${fieldName}后再上架。`)
  }
  if (rule.type === 'length') {
    const length = Array.from(stringValue(value)).length
    if (rule.min !== undefined && length < rule.min) {
      return baseIssue(rule, product, rule.field, 'TOO_SHORT', `${fieldName}当前为 ${length} 个字符，不能少于 ${rule.min} 个。`, `将${fieldName}补充至至少 ${rule.min} 个字符。`)
    }
    if (rule.max !== undefined && length > rule.max) {
      return baseIssue(rule, product, rule.field, 'TOO_LONG', `${fieldName}当前为 ${length} 个字符，不能超过 ${rule.max} 个。`, `将${fieldName}精简至 ${rule.max} 个字符以内。`)
    }
  }
  if (rule.type === 'number') {
    const numeric = typeof value === 'number' ? value : Number(stringValue(value))
    if (!Number.isFinite(numeric)) {
      return baseIssue(rule, product, rule.field, 'NOT_NUMBER', `${fieldName}必须是数字。`, '改为不带货币符号或千位分隔符的数字。')
    }
    if (rule.integer && !Number.isInteger(numeric)) {
      return baseIssue(rule, product, rule.field, 'NOT_INTEGER', `${fieldName}必须是整数。`, '改为不含小数的整数。')
    }
    if (rule.min !== undefined && numeric < rule.min) {
      return baseIssue(rule, product, rule.field, 'NUMBER_TOO_SMALL', `${fieldName}不能小于 ${rule.min}。`, `将${fieldName}调整为 ${rule.min} 或更大。`)
    }
    if (rule.max !== undefined && numeric > rule.max) {
      return baseIssue(rule, product, rule.field, 'NUMBER_TOO_LARGE', `${fieldName}不能大于 ${rule.max}。`, `将${fieldName}调整为 ${rule.max} 或更小。`)
    }
  }
  if (rule.type === 'pattern') {
    const regexp = new RegExp(rule.pattern, rule.flags)
    if (!regexp.test(stringValue(value))) {
      return baseIssue(rule, product, rule.field, 'PATTERN_MISMATCH', `${fieldName}不符合格式要求。`, `按规则要求修正${fieldName}格式。`)
    }
  }
  if (rule.type === 'enum') {
    const comparable = rule.caseSensitive ? stringValue(value) : stringValue(value).toLocaleLowerCase()
    const allowed = rule.caseSensitive ? rule.values : rule.values.map((item) => item.toLocaleLowerCase())
    if (!allowed.includes(comparable)) {
      return baseIssue(rule, product, rule.field, 'NOT_ALLOWED', `${fieldName}不在允许值列表中。`, `改为以下值之一：${rule.values.join('、')}。`)
    }
  }
  return null
}

function runUniqueRule(rule: Extract<LintRule, { type: 'unique' }>, products: CanonicalProduct[]): LintIssue[] {
  const groups = new Map<string, CanonicalProduct[]>()
  products.forEach((product) => {
    const raw = stringValue(product[rule.field])
    if (!raw) return
    const key = rule.caseSensitive ? raw : raw.toLocaleLowerCase()
    groups.set(key, [...(groups.get(key) ?? []), product])
  })
  return Array.from(groups.values())
    .filter((group) => group.length > 1)
    .flatMap((group) =>
      group.map((product) =>
        baseIssue(rule, product, rule.field, 'DUPLICATE', `${FIELD_NAMES[rule.field]}“${stringValue(product[rule.field])}”重复出现。`, '确保每个商品使用唯一 SKU。')
      )
    )
}

function runForbiddenTermsRule(
  rule: Extract<LintRule, { type: 'forbiddenTerms' }>,
  products: CanonicalProduct[]
): LintIssue[] {
  const issues: LintIssue[] = []
  products.forEach((product) => {
    rule.fields.forEach((field) => {
      const value = stringValue(product[field])
      if (!value) return
      const comparable = rule.caseSensitive ? value : value.toLocaleLowerCase()
      const term = rule.terms.find((candidate) =>
        comparable.includes(rule.caseSensitive ? candidate : candidate.toLocaleLowerCase())
      )
      if (term) {
        issues.push(
          baseIssue(rule, product, field, 'FORBIDDEN_TERM', `${FIELD_NAMES[field]}包含需复核词语“${term}”。`, `删除“${term}”或按目标平台规则确认是否允许。`)
        )
      }
    })
  })
  return issues
}

function runImageRule(
  rule: Extract<LintRule, { type: 'image' }>,
  products: CanonicalProduct[],
  images: ImageAsset[] | null
): LintIssue[] {
  if (images === null) {
    return [
      {
        ruleId: rule.id,
        severity: 'warning',
        code: 'IMAGE_CHECK_SKIPPED',
        message: '未上传图片 ZIP，本次已跳过图片质检。',
        suggestion: '需要检查图片时，上传按 SKU 命名的 ZIP 图片包。',
        sku: '',
        sourceRow: null,
        field: 'images'
      }
    ]
  }

  const issues: LintIssue[] = []
  const productBySku = new Map(
    products
      .map((product) => [stringValue(product.sku).toLocaleLowerCase(), product] as const)
      .filter(([sku]) => sku)
  )
  const imagesBySku = new Map<string, ImageAsset[]>()
  images.forEach((image) => {
    const key = image.sku.toLocaleLowerCase()
    imagesBySku.set(key, [...(imagesBySku.get(key) ?? []), image])
  })

  const duplicateNames = new Map<string, ImageAsset[]>()
  images.forEach((image) => {
    const fileName = image.name.split(/[/\\]/).pop()?.toLocaleLowerCase() ?? image.name.toLocaleLowerCase()
    duplicateNames.set(fileName, [...(duplicateNames.get(fileName) ?? []), image])
  })
  duplicateNames.forEach((group, name) => {
    if (group.length > 1) {
      issues.push({
        ruleId: rule.id,
        severity: 'warning',
        code: 'DUPLICATE_IMAGE_NAME',
        message: `图片包中存在重复文件名“${name}”。`,
        suggestion: '删除重复图片或为图片使用唯一文件名。',
        sku: group[0].sku,
        sourceRow: productBySku.get(group[0].sku.toLocaleLowerCase())?.sourceRow ?? null,
        field: 'images'
      })
    }
  })

  products.forEach((product) => {
    const sku = stringValue(product.sku)
    if (!sku) return
    const matches = imagesBySku.get(sku.toLocaleLowerCase()) ?? []
    if (matches.length < (rule.minCount ?? 0)) {
      issues.push(baseIssue(rule, product, 'images', 'IMAGE_MISSING', `SKU“${sku}”没有匹配图片。`, `添加 ${sku}.jpg 或 ${sku}_1.jpg。`))
    }
    matches.forEach((image) => {
      const allowedExtensions = rule.allowedExtensions ?? []
      const formatAllowed =
        allowedExtensions.length === 0 ||
        allowedExtensions.map((item) => item.toLocaleLowerCase()).includes(image.extension.toLocaleLowerCase())
      if (!formatAllowed) {
        issues.push(baseIssue(rule, product, 'images', 'IMAGE_FORMAT', `图片“${image.name}”格式不受支持。`, `转换为 ${allowedExtensions.join('、').toUpperCase()}。`))
      }
      if (rule.maxBytes !== undefined && image.size > rule.maxBytes) {
        issues.push(baseIssue(rule, product, 'images', 'IMAGE_TOO_LARGE', `图片“${image.name}”超过 ${(rule.maxBytes / 1024 / 1024).toFixed(0)}MB。`, '压缩图片后重试。'))
      }
      if (!formatAllowed) return
      if (image.decodeError) {
        issues.push(baseIssue(rule, product, 'images', 'IMAGE_DECODE_FAILED', `图片“${image.name}”无法解码。`, '确认文件未损坏且扩展名与实际格式一致。'))
      } else if (
        (rule.minWidth !== undefined && (image.width ?? 0) < rule.minWidth) ||
        (rule.minHeight !== undefined && (image.height ?? 0) < rule.minHeight)
      ) {
        issues.push(baseIssue(rule, product, 'images', 'IMAGE_TOO_SMALL', `图片“${image.name}”尺寸为 ${image.width ?? '?'}×${image.height ?? '?'}。`, `使用至少 ${rule.minWidth ?? 1}×${rule.minHeight ?? 1}px 的图片。`))
      }
    })
  })

  images.forEach((image) => {
    if (!productBySku.has(image.sku.toLocaleLowerCase())) {
      issues.push({
        ruleId: rule.id,
        severity: 'warning',
        code: 'ORPHAN_IMAGE',
        message: `图片“${image.name}”没有匹配商品 SKU。`,
        suggestion: '检查文件名中的 SKU，或从图片包移除无关文件。',
        sku: image.sku,
        sourceRow: null,
        field: 'images'
      })
    }
  })
  return issues
}

export function runLint({ products, mapping, rulePack, images }: LintInput): LintIssue[] {
  const issues: LintIssue[] = []
  const missingFields = new Set<CanonicalField>()

  rulePack.rules.forEach((rule) => {
    if (rule.type === 'required' && !mapping[rule.field] && !missingFields.has(rule.field)) {
      missingFields.add(rule.field)
      issues.push({
        ruleId: rule.id,
        severity: rule.severity,
        code: 'MISSING_COLUMN',
        message: `必填字段“${FIELD_NAMES[rule.field]}”尚未映射。`,
        suggestion: `返回字段映射，为${FIELD_NAMES[rule.field]}选择对应的源表列。`,
        sku: '',
        sourceRow: null,
        field: rule.field
      })
    }
  })

  rulePack.rules.forEach((rule) => {
    if (rule.type === 'image') {
      issues.push(...runImageRule(rule, products, images))
      return
    }
    if (rule.type === 'unique') {
      if (mapping[rule.field]) issues.push(...runUniqueRule(rule, products))
      return
    }
    if (rule.type === 'forbiddenTerms') {
      const availableFields = rule.fields.filter((field) => mapping[field])
      issues.push(...runForbiddenTermsRule({ ...rule, fields: availableFields }, products))
      return
    }
    if (!mapping[rule.field]) return
    products.forEach((product) => {
      const issue = issueForValueRule(rule, product)
      if (issue) issues.push(issue)
    })
  })

  return issues.sort((a, b) => {
    const rowCompare = (a.sourceRow ?? -1) - (b.sourceRow ?? -1)
    if (rowCompare !== 0) return rowCompare
    const fieldCompare = a.field.localeCompare(b.field)
    if (fieldCompare !== 0) return fieldCompare
    return a.ruleId.localeCompare(b.ruleId)
  })
}
