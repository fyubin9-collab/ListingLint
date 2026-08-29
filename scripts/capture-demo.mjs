import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'
import GIFEncoder from 'gif-encoder-2'
import { PNG } from 'pngjs'

const root = process.cwd()
const frameDir = path.join(root, 'test-results', 'demo-frames')
const outputPath = path.join(root, 'docs', 'listinglint-demo.gif')
await fs.mkdir(frameDir, { recursive: true })
await fs.mkdir(path.dirname(outputPath), { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1200, height: 675 }, deviceScaleFactor: 1 })
const frames = []

async function capture(name, delay) {
  const filePath = path.join(frameDir, `${name}.png`)
  await page.screenshot({ path: filePath })
  frames.push({ filePath, delay })
}

await page.goto('http://127.0.0.1:4173')
await page.evaluate(async () => { await document.fonts.ready })
await capture('01-home', 1_400)

await page.getByRole('button', { name: '直接体验有问题的示例' }).click()
await page.locator('.workbench').scrollIntoViewIfNeeded()
await capture('02-sheet', 1_500)

await page.getByRole('heading', { name: '先处理阻止上架的问题' }).scrollIntoViewIfNeeded()
await capture('03-results', 1_500)

await page.getByRole('group', { name: '筛选问题级别' }).getByRole('button', { name: /^警告/ }).click()
await capture('04-filtered', 1_500)
const reportDownload = page.waitForEvent('download')
await page.getByRole('button', { name: /导出 Excel 报告/ }).click()
await (await reportDownload).saveAs(path.join(root, 'test-results', 'listinglint-report.xlsx'))
await browser.close()

const decoded = await Promise.all(
  frames.map(async (frame) => ({
    ...frame,
    png: PNG.sync.read(await fs.readFile(frame.filePath))
  }))
)
const { width, height } = decoded[0].png
if (decoded.some((frame) => frame.png.width !== width || frame.png.height !== height)) {
  throw new Error('演示帧尺寸不一致')
}

const encoder = new GIFEncoder(width, height, 'neuquant', true)
encoder.start()
encoder.setRepeat(0)
encoder.setQuality(18)
decoded.forEach((frame) => {
  encoder.setDelay(frame.delay)
  encoder.addFrame(frame.png.data)
})
encoder.finish()
await fs.writeFile(outputPath, encoder.out.getData())
console.log(`Created ${path.relative(root, outputPath)}`)
