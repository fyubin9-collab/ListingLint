import { useEffect, useRef } from 'react'

export interface FeatureTourStep {
  id: string
  targetId: string
  title: string
  description: string
}

interface FeatureTourProps {
  steps: FeatureTourStep[]
  activeIndex: number
  onStepChange: (index: number) => void
  onClose: () => void
}

function scrollBehavior(): ScrollBehavior {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 'auto'
    : 'smooth'
}

export function FeatureTour({ steps, activeIndex, onStepChange, onClose }: FeatureTourProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const step = steps[activeIndex]
  const isLastStep = activeIndex === steps.length - 1

  useEffect(() => {
    panelRef.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    const target = document.getElementById(step.targetId)
    if (!target) return

    target.classList.add('tour-target--active')
    const frame = requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: scrollBehavior(), block: 'start' })
    })

    return () => {
      cancelAnimationFrame(frame)
      target.classList.remove('tour-target--active')
    }
  }, [step.targetId])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div ref={panelRef} className="feature-tour" role="dialog" aria-modal="false" aria-labelledby="feature-tour-title" tabIndex={-1}>
      <div className="feature-tour__header">
        <div>
          <span>功能导览 · 约 2 分钟</span>
          <strong>{activeIndex + 1} / {steps.length}</strong>
        </div>
        <button type="button" onClick={onClose} aria-label="关闭功能导览">×</button>
      </div>

      <div className="feature-tour__track" aria-label="导览步骤">
        {steps.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={index < activeIndex ? 'is-done' : index === activeIndex ? 'is-active' : undefined}
            aria-label={`转到第 ${index + 1} 步：${item.title}`}
            aria-current={index === activeIndex ? 'step' : undefined}
            onClick={() => onStepChange(index)}
          />
        ))}
      </div>

      <div className="feature-tour__content" aria-live="polite">
        <span>第 {activeIndex + 1} 步</span>
        <h2 id="feature-tour-title">{step.title}</h2>
        <p>{step.description}</p>
      </div>

      <div className="feature-tour__privacy">
        <span aria-hidden="true" />
        演示数据也只在当前浏览器中处理
      </div>

      <div className="feature-tour__actions">
        <button
          type="button"
          className="feature-tour__back"
          disabled={activeIndex === 0}
          onClick={() => onStepChange(activeIndex - 1)}
        >
          上一步
        </button>
        <button
          type="button"
          className="feature-tour__next"
          onClick={() => isLastStep ? onClose() : onStepChange(activeIndex + 1)}
        >
          {isLastStep ? '完成导览' : '下一步'}
          {!isLastStep && <span aria-hidden="true">→</span>}
        </button>
      </div>
    </div>
  )
}
