import type { ParsedWorkbook } from '../domain/types'

interface UploadPanelProps {
  workbook: ParsedWorkbook | null
  activeSheetIndex: number
  imageFileName: string
  imageProgress: number | null
  busy: boolean
  onTableFile: (file: File) => void
  onImageFile: (file: File) => void
  onSheetChange: (index: number) => void
  onLoadDemo: () => void
  onDownloadDemo: () => void
}

export function UploadPanel({
  workbook,
  activeSheetIndex,
  imageFileName,
  imageProgress,
  busy,
  onTableFile,
  onImageFile,
  onSheetChange,
  onLoadDemo,
  onDownloadDemo
}: UploadPanelProps) {
  return (
    <section className="control-section" aria-labelledby="source-heading">
      <div className="section-kicker">01 / 商品资料</div>
      <h2 id="source-heading">装入待检查文件</h2>
      <p className="section-copy">支持 UTF-8 CSV、XLSX，以及按 SKU 命名的可选图片 ZIP。</p>

      <div className="file-actions">
        <label className="file-button file-button--primary" htmlFor="table-file">
          <span>选择商品表</span>
          <small>最大 20MB / 5,000 行</small>
        </label>
        <input
          id="table-file"
          className="visually-hidden"
          type="file"
          accept=".csv,.xlsx"
          disabled={busy}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            if (file) onTableFile(file)
            event.currentTarget.value = ''
          }}
        />
        {workbook && (
          <div className="file-receipt">
            <span className="receipt-mark">✓</span>
            <span>
              <strong>{workbook.fileName}</strong>
              <small>{workbook.sheets[activeSheetIndex]?.rows.length.toLocaleString()} 条商品数据</small>
            </span>
          </div>
        )}
      </div>

      {workbook && workbook.sheets.length > 1 && (
        <label className="field-control" htmlFor="sheet-select">
          <span>工作表</span>
          <select id="sheet-select" value={activeSheetIndex} onChange={(event) => onSheetChange(Number(event.target.value))}>
            {workbook.sheets.map((sheet, index) => (
              <option key={`${sheet.name}-${index}`} value={index}>
                {sheet.name} · {sheet.rows.length} 行
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="file-actions file-actions--secondary">
        <label className={`file-button ${!workbook ? 'file-button--disabled' : ''}`} htmlFor="image-file">
          <span>添加图片 ZIP</span>
          <small>{workbook ? '可选 · 最大 100MB / 1,000 张' : '先选择商品表'}</small>
        </label>
        <input
          id="image-file"
          className="visually-hidden"
          type="file"
          accept=".zip,application/zip"
          disabled={!workbook || busy}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            if (file) onImageFile(file)
            event.currentTarget.value = ''
          }}
        />
        {imageFileName && (
          <div className="file-receipt file-receipt--quiet">
            <span className="receipt-mark">✓</span>
            <span>
              <strong>{imageFileName}</strong>
              <small>{imageProgress === null ? '图片索引已建立' : `正在读取 ${imageProgress}%`}</small>
            </span>
          </div>
        )}
      </div>

      <div className="demo-actions">
        <a
          className="text-button"
          href={`${import.meta.env.BASE_URL}listinglint-work-template.xlsx`}
          download="listinglint-work-template.xlsx"
        >
          下载 XLSX 工作模板
        </a>
        <button type="button" className="text-button" onClick={onLoadDemo} disabled={busy}>
          直接体验有问题的示例
        </button>
        <button type="button" className="text-button text-button--quiet" onClick={onDownloadDemo}>
          下载示例 CSV
        </button>
      </div>
    </section>
  )
}
