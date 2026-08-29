interface WorkflowRailProps {
  stage: 1 | 2 | 3
}

const steps = [
  { number: '01', label: '装入商品资料', hint: 'CSV / XLSX + ZIP' },
  { number: '02', label: '确认字段与规则', hint: '不猜测源表含义' },
  { number: '03', label: '定位上架问题', hint: '报告不修改原表' }
]

export function WorkflowRail({ stage }: WorkflowRailProps) {
  return (
    <ol className="workflow-rail" aria-label="质检流程">
      {steps.map((step, index) => {
        const position = (index + 1) as 1 | 2 | 3
        const state = position < stage ? 'done' : position === stage ? 'active' : 'pending'
        return (
          <li className={`workflow-step workflow-step--${state}`} key={step.number} aria-current={state === 'active' ? 'step' : undefined}>
            <span className="workflow-number">{state === 'done' ? '✓' : step.number}</span>
            <span>
              <strong>{step.label}</strong>
              <small>{step.hint}</small>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
