import { useMemo, useRef, useState, type MouseEvent } from 'react'
import { DataPreview } from './components/DataPreview'
import { FeatureTour, type FeatureTourStep } from './components/FeatureTour'
import { MappingPanel } from './components/MappingPanel'
import { ResultsPanel } from './components/ResultsPanel'
import { UploadPanel } from './components/UploadPanel'
import { WorkflowRail } from './components/WorkflowRail'
import customRulePackExample from '../examples/custom-rule-pack.json'
import { demoCsv, demoImages, demoWorkbook } from './data/demo'
import { genericRulePack } from './data/genericRulePack'
import { getIssueKey } from './domain/issues'
import { runLint } from './domain/lintEngine'
import { FIELD_NAMES, getDuplicateMappedHeaders, mapProducts, suggestMapping } from './domain/mapping'
import { getRequiredFields, parseRulePack } from './domain/rulePack'
import type {
  CanonicalField,
  ColumnMapping,
  ImageAsset,
  LintIssue,
  ParsedWorkbook,
  RulePack
} from './domain/types'

interface Notice {
  tone: 'error' | 'success' | 'info'
  text: string
}

const FEATURE_TOUR_STEPS: FeatureTourStep[] = [
  {
    id: 'files',
    targetId: 'tour-files',
    title: '准备商品资料',
    description: '先放入 CSV 或 XLSX 商品表；如果还要检查图片，再加入按 SKU 命名的 ZIP。引导已经替你装入一套有问题的示例。'
  },
  {
    id: 'mapping',
    targetId: 'tour-mapping',
    title: '确认字段对应关系',
    description: '确认源表里的“售价”“库存”等列分别代表什么。必填字段没有对应好时，系统会明确提示并阻止误运行；这里也能换成自己的规则。'
  },
  {
    id: 'run',
    targetId: 'tour-run',
    title: '运行上架前质检',
    description: '确认资料和字段后运行质检。它按照固定规则逐行检查，同一份资料每次都会得到相同结果。'
  },
  {
    id: 'preview',
    targetId: 'tour-preview',
    title: '从原表查看问题位置',
    description: '红色代表阻止上架的问题，黄色代表需要人工确认。每个标记都保留源表行号，不需要在几百行数据里反复寻找。'
  },
  {
    id: 'results',
    targetId: 'tour-results',
    title: '按商品整理问题',
    description: '问题会按 SKU 和源表行合并。先处理“阻止上架”，再复核警告，可以减少同一个商品被拆成很多零散记录。'
  },
  {
    id: 'locate',
    targetId: 'issue-review-panel',
    title: '定位错误并查看改法',
    description: '点击“定位到第几行”后，上方会持续显示具体原因和修改建议；还可以直接切换上一条、下一条问题。'
  },
  {
    id: 'filters',
    targetId: 'tour-filters',
    title: '筛选和搜索问题',
    description: '可以只看错误或警告，也能按 SKU、行号和问题关键词搜索，快速缩小需要处理的范围。'
  },
  {
    id: 'export',
    targetId: 'tour-export',
    title: '导出复核报告',
    description: '处理前先导出 Excel 报告。报告包含整体情况、问题明细、字段对应关系和所用规则，方便交接与复核。'
  }
]

function waitForScanFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => window.setTimeout(resolve, 260))
  })
}

function preferredScrollBehavior(): ScrollBehavior {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 'auto'
    : 'smooth'
}

export default function App() {
  const tourTriggerRef = useRef<HTMLButtonElement>(null)
  const lastTourTriggerRef = useRef<HTMLButtonElement | null>(null)
  const [workbook, setWorkbook] = useState<ParsedWorkbook | null>(null)
  const [activeSheetIndex, setActiveSheetIndex] = useState(0)
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [rulePack, setRulePack] = useState<RulePack>(genericRulePack)
  const [images, setImages] = useState<ImageAsset[] | null>(null)
  const [imageFileName, setImageFileName] = useState('')
  const [imageProgress, setImageProgress] = useState<number | null>(null)
  const [issues, setIssues] = useState<LintIssue[] | null>(null)
  const [selectedRow, setSelectedRow] = useState<number | null>(null)
  const [selectedIssue, setSelectedIssue] = useState<LintIssue | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [parsing, setParsing] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [tourStep, setTourStep] = useState<number | null>(null)

  const activeSheet = workbook?.sheets[activeSheetIndex] ?? null
  const products = useMemo(
    () => (activeSheet ? mapProducts(activeSheet, mapping) : []),
    [activeSheet, mapping]
  )
  const duplicateMappedHeaders = useMemo(() => getDuplicateMappedHeaders(mapping), [mapping])
  const missingRequiredFields = useMemo(
    () => getRequiredFields(rulePack).filter((field) => !mapping[field]),
    [mapping, rulePack]
  )
  const locatableIssues = useMemo(
    () => issues?.filter((issue) => issue.sourceRow !== null) ?? [],
    [issues]
  )
  const selectedIssueIndex = selectedIssue
    ? locatableIssues.findIndex((issue) => getIssueKey(issue) === getIssueKey(selectedIssue))
    : -1
  const busy = parsing || scanning || imageProgress !== null || exporting
  const stage: 1 | 2 | 3 = issues !== null ? 3 : workbook ? 2 : 1

  const clearResult = () => {
    setIssues(null)
    setSelectedRow(null)
    setSelectedIssue(null)
  }

  const handleTableFile = async (file: File) => {
    setParsing(true)
    setNotice({ tone: 'info', text: `正在读取 ${file.name}…` })
    try {
      const { parseTableFile } = await import('./domain/tableParser')
      const parsed = await parseTableFile(file)
      const nextSheet = parsed.sheets[0]
      setWorkbook(parsed)
      setActiveSheetIndex(0)
      setMapping(suggestMapping(nextSheet.headers, rulePack))
      setImages(null)
      setImageFileName('')
      clearResult()
      setNotice({
        tone: 'success',
        text: `已读取 ${nextSheet.rows.length.toLocaleString()} 条商品数据，请确认字段映射。`
      })
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : '无法读取商品表。' })
    } finally {
      setParsing(false)
    }
  }

  const handleImageFile = async (file: File) => {
    if (!activeSheet) return
    setImageProgress(0)
    setImageFileName(file.name)
    setNotice({ tone: 'info', text: `正在建立 ${file.name} 的图片索引…` })
    try {
      const { inspectImageZip } = await import('./domain/imageInspector')
      const knownSkus = products.map((product) => String(product.sku ?? '').trim()).filter(Boolean)
      const inspected = await inspectImageZip(file, knownSkus, (completed, total) => {
        setImageProgress(Math.round((completed / total) * 100))
      })
      setImages(inspected)
      clearResult()
      setNotice({ tone: 'success', text: `已读取 ${inspected.length.toLocaleString()} 个图片文件。` })
    } catch (error) {
      setImages(null)
      setImageFileName('')
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : '无法读取图片 ZIP。' })
    } finally {
      setImageProgress(null)
    }
  }

  const handleSheetChange = (index: number) => {
    if (!workbook) return
    const nextSheet = workbook.sheets[index]
    setActiveSheetIndex(index)
    setMapping(suggestMapping(nextSheet.headers, rulePack))
    setImages(null)
    setImageFileName('')
    clearResult()
    setNotice({ tone: 'info', text: `已切换到工作表“${nextSheet.name}”，请重新确认字段映射。` })
  }

  const handleMappingChange = (field: CanonicalField, header: string) => {
    setMapping((current) => ({ ...current, [field]: header || undefined }))
    if (field === 'sku' && images !== null) {
      setImages(null)
      setImageFileName('')
      setNotice({ tone: 'info', text: 'SKU 映射已变化；如需图片质检，请重新选择图片 ZIP。' })
    }
    clearResult()
  }

  const handleRuleFile = async (file: File) => {
    try {
      const parsed = parseRulePack(JSON.parse(await file.text()))
      setRulePack(parsed)
      if (activeSheet) setMapping(suggestMapping(activeSheet.headers, parsed))
      clearResult()
      setNotice({ tone: 'success', text: `已启用规则包“${parsed.name}” v${parsed.version}。` })
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : '无法读取规则包 JSON。' })
    }
  }

  const resetRulePack = () => {
    setRulePack(genericRulePack)
    if (activeSheet) setMapping(suggestMapping(activeSheet.headers, genericRulePack))
    clearResult()
    setNotice({ tone: 'info', text: '已恢复通用跨境商品规则。' })
  }

  const runInspection = async () => {
    if (!activeSheet) {
      setNotice({ tone: 'error', text: '请先选择商品表。' })
      return
    }
    if (duplicateMappedHeaders.length > 0) {
      setNotice({ tone: 'error', text: '存在重复字段映射，请先修正后再质检。' })
      return
    }
    if (missingRequiredFields.length > 0) {
      setNotice({
        tone: 'error',
        text: `还不能运行：请先映射${missingRequiredFields.map((field) => FIELD_NAMES[field]).join('、')}。`
      })
      return
    }

    setScanning(true)
    setSelectedRow(null)
    setSelectedIssue(null)
    setNotice({ tone: 'info', text: '正在按当前映射和规则逐行检查…' })
    await waitForScanFrame()
    const nextProducts = mapProducts(activeSheet, mapping)
    const nextIssues = runLint({ products: nextProducts, mapping, rulePack, images })
    setIssues(nextIssues)
    setScanning(false)
    const errorCount = nextIssues.filter((issue) => issue.severity === 'error').length
    setNotice({
      tone: errorCount > 0 ? 'info' : 'success',
      text: errorCount > 0 ? `质检完成：发现 ${errorCount} 个阻止上架的问题。` : '质检完成：未发现阻止上架的问题。'
    })
    requestAnimationFrame(() => document.getElementById('results-heading')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const loadDemo = () => {
    const sheet = demoWorkbook.sheets[0]
    const demoMapping = suggestMapping(sheet.headers, genericRulePack)
    const demoProducts = mapProducts(sheet, demoMapping)
    const demoIssues = runLint({ products: demoProducts, mapping: demoMapping, rulePack: genericRulePack, images: demoImages })
    setWorkbook(demoWorkbook)
    setActiveSheetIndex(0)
    setMapping(demoMapping)
    setRulePack(genericRulePack)
    setImages(demoImages)
    setImageFileName('listinglint-demo-images.zip')
    setIssues(demoIssues)
    setSelectedRow(null)
    setSelectedIssue(null)
    setNotice({ tone: 'success', text: '演示数据已装入；表格中的标记与下方报告一一对应。' })
  }

  const startFeatureTour = (event?: MouseEvent<HTMLButtonElement>) => {
    lastTourTriggerRef.current = event?.currentTarget ?? tourTriggerRef.current
    loadDemo()
    setTourStep(0)
    setNotice({ tone: 'info', text: '功能导览已准备好演示数据；跟随步骤了解一次完整质检。' })
  }

  const changeFeatureTourStep = (nextStep: number) => {
    const boundedStep = Math.min(Math.max(nextStep, 0), FEATURE_TOUR_STEPS.length - 1)
    if (FEATURE_TOUR_STEPS[boundedStep].id === 'locate') {
      const firstIssue = locatableIssues[0]
      if (firstIssue) {
        setSelectedIssue(firstIssue)
        setSelectedRow(firstIssue.sourceRow)
      }
    }
    setTourStep(boundedStep)
  }

  const closeFeatureTour = () => {
    setTourStep(null)
    requestAnimationFrame(() => lastTourTriggerRef.current?.focus())
  }

  const downloadDemo = () => {
    const blob = new Blob([`\uFEFF${demoCsv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'listinglint-demo.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const downloadRuleExample = () => {
    const blob = new Blob([JSON.stringify(customRulePackExample, null, 2)], {
      type: 'application/json;charset=utf-8'
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'listinglint-rule-pack.example.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const exportReport = async () => {
    if (!workbook || issues === null) return
    setExporting(true)
    try {
      const { downloadReport } = await import('./domain/report')
      await downloadReport({
        sourceName: workbook.fileName,
        productCount: products.length,
        issues,
        mapping,
        rulePack
      })
      setNotice({ tone: 'success', text: 'Excel 报告已生成并开始下载。' })
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : '无法生成 Excel 报告。' })
    } finally {
      setExporting(false)
    }
  }

  const focusIssue = (issue: LintIssue) => {
    if (issue.sourceRow === null) return
    setSelectedIssue(issue)
    setSelectedRow(issue.sourceRow)
    requestAnimationFrame(() => {
      const reviewPanel = document.getElementById('issue-review-panel')
      document.getElementById(`data-row-${issue.sourceRow}`)?.scrollIntoView({
        behavior: preferredScrollBehavior(),
        block: 'center'
      })
      reviewPanel?.focus({ preventScroll: true })
    })
  }

  const moveSelectedIssue = (offset: number) => {
    const nextIssue = locatableIssues[selectedIssueIndex + offset]
    if (nextIssue) focusIssue(nextIssue)
  }

  const clearIssueSelection = () => {
    setSelectedRow(null)
    setSelectedIssue(null)
  }

  const returnToResults = () => {
    clearIssueSelection()
    requestAnimationFrame(() => {
      const resultsHeading = document.getElementById('results-heading')
      resultsHeading?.scrollIntoView({ behavior: preferredScrollBehavior(), block: 'start' })
      resultsHeading?.focus({ preventScroll: true })
    })
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="ListingLint 首页">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <span>
            <strong>ListingLint</strong>
            <small>电商商品上架质检</small>
          </span>
        </a>
        <div className="header-actions">
          <button
            ref={tourTriggerRef}
            type="button"
            className="tour-launch"
            aria-haspopup="dialog"
            disabled={busy}
            onClick={startFeatureTour}
          >
            <span aria-hidden="true" className="tour-launch__mark" />
            <span>新手导览</span>
            <small>先看这里 →</small>
          </button>
          <div className="local-badge">
            <span className="local-badge__dot" aria-hidden="true" />
            <span className="local-badge__label">浏览器本地处理</span>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <div>
            <div className="hero-label">商品上架质检工作台</div>
            <h1 id="hero-title">上架前，把每个问题<br /><span>定位到具体行。</span></h1>
          </div>
          <div className="hero-copy">
            <p>选择本地商品表和图片包，检查字段、SKU、价格、库存与图片规格，并生成可定位的问题报告。</p>
            <button
              type="button"
              className="tour-spotlight"
              aria-label="开始功能导览"
              disabled={busy}
              onClick={startFeatureTour}
            >
              <span className="tour-spotlight__copy">
                <small>第一次使用？</small>
                <strong>跟着示例走一遍完整质检</strong>
                <span>约 2 分钟 · 8 个步骤 · 不需要准备文件</span>
              </span>
              <span className="tour-spotlight__action" aria-hidden="true">
                开始
                <b>→</b>
              </span>
            </button>
            <ul className="privacy-line" aria-label="数据处理说明">
              <li>仅在浏览器处理</li>
              <li>不修改源表</li>
              <li>报告可复核</li>
            </ul>
          </div>
        </section>

        <WorkflowRail stage={stage} />

        {notice && (
          <div className={`notice notice--${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
            <span aria-hidden="true">{notice.tone === 'error' ? '!' : notice.tone === 'success' ? '✓' : 'i'}</span>
            {notice.text}
            <button type="button" onClick={() => setNotice(null)} aria-label="关闭提示">×</button>
          </div>
        )}

        <div className="workbench">
          <aside className="control-panel">
            <UploadPanel
              workbook={workbook}
              activeSheetIndex={activeSheetIndex}
              imageFileName={imageFileName}
              imageProgress={imageProgress}
              busy={busy}
              onTableFile={handleTableFile}
              onImageFile={handleImageFile}
              onSheetChange={handleSheetChange}
              onLoadDemo={loadDemo}
              onDownloadDemo={downloadDemo}
            />
            <MappingPanel
              headers={activeSheet?.headers ?? []}
              mapping={mapping}
              rulePack={rulePack}
              duplicateHeaders={duplicateMappedHeaders}
              disabled={!activeSheet || busy}
              onMappingChange={handleMappingChange}
              onRuleFile={handleRuleFile}
              onDownloadRuleExample={downloadRuleExample}
              onResetRulePack={resetRulePack}
            />
            <div id="tour-run" className="run-zone">
              <button
                type="button"
                className="run-button"
                disabled={!activeSheet || busy || duplicateMappedHeaders.length > 0 || missingRequiredFields.length > 0}
                onClick={runInspection}
              >
                <span>{scanning ? '正在逐行质检…' : '运行 ListingLint'}</span>
                <span aria-hidden="true">→</span>
              </button>
              {activeSheet && (duplicateMappedHeaders.length > 0 || missingRequiredFields.length > 0) ? (
                <p className="run-blocker" role="alert">
                  还不能运行：
                  {missingRequiredFields.length > 0 && `请映射${missingRequiredFields.map((field) => FIELD_NAMES[field]).join('、')}`}
                  {missingRequiredFields.length > 0 && duplicateMappedHeaders.length > 0 && '；'}
                  {duplicateMappedHeaders.length > 0 && '请修正重复映射'}。
                </p>
              ) : (
                <small>只生成问题报告，不会改动你的源文件。</small>
              )}
            </div>
          </aside>

          <section id="tour-preview" className="inspection-sheet" aria-label="商品表格预览">
            <div className="sheet-toolbar">
              <div>
                <span className="sheet-status-light" aria-hidden="true" />
                <strong>{workbook?.fileName ?? '尚未选择文件'}</strong>
                {activeSheet && <small>{activeSheet.name} / {activeSheet.rows.length.toLocaleString()} 行</small>}
              </div>
              <div className="sheet-legend">
                <span><i className="legend-dot legend-dot--error" />错误</span>
                <span><i className="legend-dot legend-dot--warning" />警告</span>
              </div>
            </div>
            {selectedIssue && selectedIssue.sourceRow !== null && (
              <div
                id="issue-review-panel"
                className={`issue-review-panel issue-review-panel--${selectedIssue.severity}`}
                role="region"
                aria-label="当前定位问题"
                aria-live="polite"
                tabIndex={-1}
              >
                <div className="issue-review-panel__topline">
                  <span>{selectedIssue.severity === 'error' ? '阻止上架' : '需要人工复核'}</span>
                  <span>第 {selectedIssue.sourceRow} 行 · {selectedIssue.sku || '未填写 SKU'}</span>
                  <span>{selectedIssueIndex + 1} / {locatableIssues.length}</span>
                </div>
                <div className="issue-review-panel__content">
                  <div>
                    <span className="issue-review-panel__label">发现的问题</span>
                    <strong>{selectedIssue.message}</strong>
                  </div>
                  <div>
                    <span className="issue-review-panel__label">建议修改</span>
                    <p>{selectedIssue.suggestion}</p>
                  </div>
                </div>
                <div className="issue-review-panel__actions">
                  <button type="button" disabled={selectedIssueIndex <= 0} onClick={() => moveSelectedIssue(-1)}>← 上一问题</button>
                  <button type="button" disabled={selectedIssueIndex >= locatableIssues.length - 1} onClick={() => moveSelectedIssue(1)}>下一问题 →</button>
                  <button type="button" onClick={returnToResults}>回到问题清单</button>
                </div>
              </div>
            )}
            <DataPreview
              sheet={activeSheet}
              mapping={mapping}
              issues={issues}
              selectedRow={selectedRow}
              selectedIssue={selectedIssue}
              scanning={scanning}
              onClearSelection={clearIssueSelection}
            />
          </section>
        </div>

        {issues !== null && (
          <ResultsPanel
            issues={issues}
            productCount={products.length}
            selectedIssue={selectedIssue}
            onLocate={focusIssue}
            onExport={exportReport}
            exporting={exporting}
          />
        )}

        <section className="privacy-note" aria-labelledby="privacy-heading">
          <div>
            <div className="section-kicker">隐私与数据</div>
            <h2 id="privacy-heading">文件只在当前浏览器中处理</h2>
            <p>商品表、图片和报告不会上传或持久化；刷新页面即清空。请在关闭页面前下载需要保留的报告。</p>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <span>ListingLint v0.1.4 · MIT License</span>
        <span>确定性规则 · 结果可复核</span>
      </footer>

      {tourStep !== null && (
        <FeatureTour
          steps={FEATURE_TOUR_STEPS}
          activeIndex={tourStep}
          onStepChange={changeFeatureTourStep}
          onClose={closeFeatureTour}
        />
      )}
    </div>
  )
}
