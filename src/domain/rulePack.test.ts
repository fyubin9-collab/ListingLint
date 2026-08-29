import { genericRulePack } from '../data/genericRulePack'
import customRulePack from '../../examples/custom-rule-pack.json'
import { parseRulePack, RulePackValidationError } from './rulePack'

describe('rule pack validation', () => {
  it('accepts the built-in rule pack', () => {
    expect(parseRulePack(genericRulePack)).toEqual(genericRulePack)
  })

  it('accepts the committed custom rule example', () => {
    expect(parseRulePack(customRulePack)).toMatchObject({
      id: 'example-store-us-v1',
      schemaVersion: 1
    })
  })

  it('rejects unsupported schema versions with a JSON path', () => {
    expect(() => parseRulePack({ ...genericRulePack, schemaVersion: 2 })).toThrowError(
      expect.objectContaining<Partial<RulePackValidationError>>({
        details: expect.arrayContaining([expect.stringContaining('$.schemaVersion')])
      })
    )
  })

  it('rejects duplicate ids, unknown alias fields and invalid patterns', () => {
    const broken = {
      ...genericRulePack,
      fieldAliases: { unknown: ['Other'] },
      rules: [
        { id: 'same', type: 'required', field: 'sku', severity: 'error' },
        { id: 'same', type: 'pattern', field: 'sku', pattern: '[', severity: 'error' }
      ]
    }
    expect(() => parseRulePack(broken)).toThrowError(RulePackValidationError)
    try {
      parseRulePack(broken)
    } catch (error) {
      const details = (error as RulePackValidationError).details.join('\n')
      expect(details).toContain('$.fieldAliases.unknown')
      expect(details).toContain('$.rules[1].id')
      expect(details).toContain('$.rules[1].pattern')
    }
  })
})
