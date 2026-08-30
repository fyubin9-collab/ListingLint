import { useMemo, useState } from 'react'
import { DataPreview } from './components/DataPreview'
import { MappingPanel } from './components/MappingPanel'
import { ResultsPanel } from './components/ResultsPanel'
import { UploadPanel } from './components/UploadPanel'
import { WorkflowRail } from './components/WorkflowRail'
import customRulePackExample from '../examples/custom-rule-pack.json'
import { demoCsv, demoImages, demoWorkbook } from './data/demo'
import { genericRulePack } from './data/genericRulePack'
import { runLint } from './domain/lintEngine'
import { getDuplicateMappedHeaders, mapProducts, suggestMapping } from './domain/mapping'
import { parseRulePack } from './domain/rulePack'
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

function waitForScanFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => window.setTimeout(resolve, 260))
  })
}

export default function App() {
  const [workbook, setWorkbook] = useState<ParsedWorkbook | null>(null)
  const [activeSheetIndex, setActiveSheetIndex] = useState(0)
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [rulePack, setRulePack] = useState<RulePack>(genericRulePack)
  const [images, setImages] = useState<ImageAsset[] | null>(null)
  const [imageFileName, setImageFileName] = useState('')
  const [imageProgress, setImageProgress] = useState<number | null>(null)
  const [issues, setIssues] = useState<LintIssue[] | null>(null)
  const [selectedRow, setSelectedRow] = useState<number | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [parsing, setParsing] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [exporting, setExporting] = useState(false)

  const activeSheet = workbook?.sheets[activeSheetIndex] ?? null
  const products = useMemo(
    () => (activeSheet ? mapProducts(activeSheet, mapping) : []),
    [activeSheet, mapping]
  )
  const duplicateMappedHeaders = useMemo(() => getDuplicateMappedHeaders(mapping), [mapping])
  const busy = parsing || scanning || imageProgress !== null || exporting
  const stage: 1 | 2 | 3 = issues !== null ? 3 : workbook ? 2 : 1

  const clearResult = () => {
    setIssues(null)
    setSelectedRow(null)
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

    setScanning(true)
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
    setNotice({ tone: 'success', text: '演示数据已装入；表格中的标记与下方报告一一对应。' })
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

  const locateIssue = (sourceRow: number) => {
    setSelectedRow(sourceRow)
    document.getElementById('data-preview')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
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
        <div className="local-badge">
          <span aria-hidden="true" />
          浏览器本地处理
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
            <div className="run-zone">
              <button type="button" className="run-button" disabled={!activeSheet || busy || duplicateMappedHeaders.length > 0} onClick={runInspection}>
                <span>{scanning ? '正在逐行质检…' : '运行 ListingLint'}</span>
                <span aria-hidden="true">→</span>
              </button>
              <small>只生成问题报告，不会改动你的源文件。</small>
            </div>
          </aside>

          <section className="inspection-sheet" aria-label="商品表格预览">
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
            <DataPreview
              sheet={activeSheet}
              mapping={mapping}
              issues={issues}
              selectedRow={selectedRow}
              scanning={scanning}
              onClearSelection={() => setSelectedRow(null)}
            />
          </section>
        </div>

        {issues !== null && (
          <ResultsPanel
            issues={issues}
            productCount={products.length}
            onLocate={locateIssue}
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
        <span>ListingLint v0.1.2 · MIT License</span>
        <span>确定性规则 · 结果可复核</span>
      </footer>
    </div>
  )
}
