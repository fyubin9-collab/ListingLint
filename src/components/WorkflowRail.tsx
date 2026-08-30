interface WorkflowRailProps {
  stage: 1 | 2 | 3
}

const steps = [
  { number: '01', label: '选择商品资料', hint: 'CSV / XLSX，可选图片 ZIP' },
  { number: '02', label: '确认字段与规则', hint: '核对自动映射结果' },
  { number: '03', label: '检查并导出', hint: '定位问题，不修改源表' }
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
