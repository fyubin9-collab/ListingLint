import { z } from 'zod'
import {
  CANONICAL_FIELDS,
  type CanonicalField,
  type RulePack
} from './types'

const canonicalFieldSchema = z.enum(CANONICAL_FIELDS)
const severitySchema = z.enum(['error', 'warning']).default('error')
const idSchema = z
  .string()
  .min(1, '不能为空')
  .max(80, '不能超过 80 个字符')
  .regex(/^[a-z0-9][a-z0-9._-]*$/i, '只能包含字母、数字、点、下划线或连字符')

const baseRuleSchema = z.object({
  id: idSchema,
  severity: severitySchema,
  message: z.string().max(200).optional(),
  suggestion: z.string().max(300).optional()
})

const ruleSchema = z.discriminatedUnion('type', [
  baseRuleSchema.extend({
    type: z.literal('required'),
    field: canonicalFieldSchema
  }),
  baseRuleSchema.extend({
    type: z.literal('unique'),
    field: canonicalFieldSchema,
    caseSensitive: z.boolean().optional()
  }),
  baseRuleSchema
    .extend({
      type: z.literal('length'),
      field: canonicalFieldSchema,
      min: z.number().int().nonnegative().optional(),
      max: z.number().int().positive().optional()
    })
    .refine((rule) => rule.min !== undefined || rule.max !== undefined, {
      message: 'min 和 max 至少填写一个'
    })
    .refine(
      (rule) => rule.min === undefined || rule.max === undefined || rule.min <= rule.max,
      { message: 'min 不能大于 max' }
    ),
  baseRuleSchema
    .extend({
      type: z.literal('number'),
      field: canonicalFieldSchema,
      min: z.number().optional(),
      max: z.number().optional(),
      integer: z.boolean().optional()
    })
    .refine(
      (rule) => rule.min === undefined || rule.max === undefined || rule.min <= rule.max,
      { message: 'min 不能大于 max' }
    ),
  baseRuleSchema.extend({
    type: z.literal('pattern'),
    field: canonicalFieldSchema,
    pattern: z.string().min(1).max(200),
    flags: z.string().regex(/^[imu]*$/, 'flags 只允许 i、m、u').optional()
  }),
  baseRuleSchema.extend({
    type: z.literal('forbiddenTerms'),
    fields: z.array(canonicalFieldSchema).min(1),
    terms: z.array(z.string().min(1).max(100)).min(1).max(100),
    caseSensitive: z.boolean().optional()
  }),
  baseRuleSchema.extend({
    type: z.literal('enum'),
    field: canonicalFieldSchema,
    values: z.array(z.string()).min(1).max(200),
    caseSensitive: z.boolean().optional()
  }),
  baseRuleSchema.extend({
    type: z.literal('image'),
    minCount: z.number().int().nonnegative().optional(),
    allowedExtensions: z
      .array(z.string().regex(/^[a-z0-9]+$/i))
      .min(1)
      .optional(),
    maxBytes: z.number().int().positive().optional(),
    minWidth: z.number().int().positive().optional(),
    minHeight: z.number().int().positive().optional()
  })
])

export const rulePackSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: idSchema,
    name: z.string().min(1).max(80),
    version: z.string().min(1).max(40),
    description: z.string().max(300).optional(),
    fieldAliases: z.record(z.string(), z.array(z.string().min(1).max(80))).default({}),
    rules: z.array(ruleSchema).min(1).max(200)
  })
  .strict()
  .superRefine((pack, context) => {
    const allowedFields = new Set<string>(CANONICAL_FIELDS)
    Object.keys(pack.fieldAliases).forEach((field) => {
      if (!allowedFields.has(field)) {
        context.addIssue({
          code: 'custom',
          message: `未知标准字段：${field}`,
          path: ['fieldAliases', field]
        })
      }
    })

    const ids = new Set<string>()
    pack.rules.forEach((rule, index) => {
      if (ids.has(rule.id)) {
        context.addIssue({
          code: 'custom',
          message: `规则 id 重复：${rule.id}`,
          path: ['rules', index, 'id']
        })
      }
      ids.add(rule.id)

      if (rule.type === 'pattern') {
        try {
          new RegExp(rule.pattern, rule.flags)
        } catch {
          context.addIssue({
            code: 'custom',
            message: '无法编译该正则表达式',
            path: ['rules', index, 'pattern']
          })
        }
      }
    })
  })

export class RulePackValidationError extends Error {
  readonly details: string[]

  constructor(details: string[]) {
    super(`规则包无效：${details.join('；')}`)
    this.name = 'RulePackValidationError'
    this.details = details
  }
}

function formatPath(path: PropertyKey[]): string {
  if (path.length === 0) return '$'
  return `$${path
    .map((part) => (typeof part === 'number' ? `[${part}]` : `.${String(part)}`))
    .join('')}`
}

export function parseRulePack(input: unknown): RulePack {
  const result = rulePackSchema.safeParse(input)
  if (!result.success) {
    throw new RulePackValidationError(
      result.error.issues.map((issue) => `${formatPath(issue.path)} ${issue.message}`)
    )
  }
  return result.data as RulePack
}

export function getRequiredFields(pack: RulePack): CanonicalField[] {
  return Array.from(
    new Set(
      pack.rules
        .filter((rule) => rule.type === 'required')
        .map((rule) => rule.field)
    )
  )
}
