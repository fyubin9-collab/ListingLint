import type { ChangeEvent } from 'react'
import { CANONICAL_FIELDS, type CanonicalField, type ColumnMapping, type RulePack } from '../domain/types'
import { FIELD_LABELS } from '../domain/mapping'
import { getRequiredFields } from '../domain/rulePack'

interface MappingPanelProps {
  headers: string[]
  mapping: ColumnMapping
  rulePack: RulePack
  duplicateHeaders: string[]
  disabled: boolean
  onMappingChange: (field: CanonicalField, header: string) => void
  onRuleFile: (file: File) => void
  onDownloadRuleExample: () => void
  onResetRulePack: () => void
}

export function MappingPanel({
  headers,
  mapping,
  rulePack,
  duplicateHeaders,
  disabled,
  onMappingChange,
  onRuleFile,
  onDownloadRuleExample,
  onResetRulePack
}: MappingPanelProps) {
  const required = new Set(getRequiredFields(rulePack))

  const handleRuleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    if (file) onRuleFile(file)
    event.currentTarget.value = ''
  }

  return (
    <section className={`control-section ${disabled ? 'control-section--disabled' : ''}`} aria-labelledby="mapping-heading">
      <div className="section-kicker">02 / 字段与规则</div>
      <h2 id="mapping-heading">确认系统读懂了哪一列</h2>
      <p className="section-copy">自动识别只给建议。你确认后，质检才会使用这些字段。</p>

      <div className="mapping-grid">
        {CANONICAL_FIELDS.map((field) => (
          <label className="mapping-row" key={field}>
            <span>
              {FIELD_LABELS[field]}
              {required.has(field) && <em>必填</em>}
            </span>
            <select
              value={mapping[field] ?? ''}
              disabled={disabled}
              aria-label={`${FIELD_LABELS[field]} 对应源表列`}
              onChange={(event) => onMappingChange(field, event.target.value)}
            >
              <option value="">未映射</option>
              {headers.map((header) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      {duplicateHeaders.length > 0 && (
        <p className="inline-alert" role="alert">
          “{duplicateHeaders.join('、')}”被重复映射，请为每个标准字段选择不同列。
        </p>
      )}

      <div className="rule-receipt">
        <div>
          <span className="rule-dot" aria-hidden="true" />
          <strong>{rulePack.name}</strong>
          <small>v{rulePack.version} · {rulePack.rules.length} 条规则</small>
        </div>
        <div className="rule-actions">
          <label className="text-button" htmlFor="rule-file">导入 JSON</label>
          <input id="rule-file" className="visually-hidden" type="file" accept=".json,application/json" disabled={disabled} onChange={handleRuleFile} />
          <button type="button" className="text-button text-button--quiet" onClick={onDownloadRuleExample}>
            下载规则示例
          </button>
          {rulePack.id !== 'generic-cross-border-v1' && (
            <button type="button" className="text-button text-button--quiet" onClick={onResetRulePack}>
              恢复通用规则
            </button>
          )}
        </div>
      </div>
      <p className="rule-disclaimer">{rulePack.description}</p>
    </section>
  )
}
