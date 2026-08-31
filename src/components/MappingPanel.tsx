import { useState, type ChangeEvent } from 'react'
import { CANONICAL_FIELDS, type CanonicalField, type ColumnMapping, type RulePack } from '../domain/types'
import { FIELD_LABELS, FIELD_NAMES } from '../domain/mapping'
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
  const missingRequiredFields = [...required].filter((field) => !mapping[field])
  const mappedRequiredCount = required.size - missingRequiredFields.length
  const hasMappingProblems = missingRequiredFields.length > 0 || duplicateHeaders.length > 0
  const [detailsOpen, setDetailsOpen] = useState(false)
  const detailsVisible = !disabled && (detailsOpen || hasMappingProblems)

  const handleRuleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    if (file) onRuleFile(file)
    event.currentTarget.value = ''
  }

  return (
    <section className={`control-section ${disabled ? 'control-section--disabled' : ''}`} aria-labelledby="mapping-heading">
      <div className="section-kicker">02 / 字段与规则</div>
      <h2 id="mapping-heading">确认字段映射</h2>
      <p className="section-copy">系统会自动匹配常见列名；请核对后再运行质检。</p>

      <div className={`mapping-summary ${hasMappingProblems ? 'mapping-summary--attention' : 'mapping-summary--ready'}`} aria-live="polite">
        <div>
          <span className="mapping-summary__mark" aria-hidden="true">{hasMappingProblems ? '!' : '✓'}</span>
          <span>
            <strong>
              {disabled
                ? '等待选择商品表'
                : hasMappingProblems
                  ? `还需处理 ${missingRequiredFields.length + duplicateHeaders.length} 项映射`
                  : `必填字段已映射 ${mappedRequiredCount}/${required.size}`}
            </strong>
            <small>
              {disabled
                ? '选择文件后会自动识别常见中英文字段。'
                : missingRequiredFields.length > 0
                  ? `未映射：${missingRequiredFields.map((field) => FIELD_NAMES[field]).join('、')}`
                  : duplicateHeaders.length > 0
                    ? `重复使用：${duplicateHeaders.join('、')}`
                    : '可以直接运行，也可以展开检查或修改。'}
            </small>
          </span>
        </div>
        {hasMappingProblems && !disabled ? (
          <span className="mapping-required">需要处理</span>
        ) : (
          <button
            type="button"
            className="mapping-toggle"
            disabled={disabled}
            aria-expanded={detailsVisible}
            aria-controls="mapping-fields"
            onClick={() => setDetailsOpen((current) => !current)}
          >
            {detailsVisible ? '收起字段' : '检查或修改'}
          </button>
        )}
      </div>

      <div id="mapping-fields" hidden={!detailsVisible}>
        <div className="mapping-grid">
          {CANONICAL_FIELDS.map((field) => (
            <label className={`mapping-row ${required.has(field) && !mapping[field] ? 'mapping-row--missing' : ''}`} key={field}>
              <span>
                {FIELD_LABELS[field]}
                {required.has(field) && <em>必填</em>}
              </span>
              <select
                value={mapping[field] ?? ''}
                disabled={disabled}
                aria-invalid={required.has(field) && !mapping[field]}
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
      </div>

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
