import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('built-in demo supports filtering, locating and Excel export', async ({ page }) => {
  const externalRequests: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.origin !== 'http://127.0.0.1:4173') externalRequests.push(request.url())
  })

  await page.goto('/')
  await page.evaluate(async () => { await document.fonts.ready })
  await expect(page.getByRole('heading', { name: /问题不该藏在\s*第 847 行。/ })).toBeVisible()
  await page.getByRole('button', { name: '直接体验有问题的示例' }).click()

  await expect(page.getByRole('heading', { name: '先处理阻止上架的问题' })).toBeVisible()
  await expect(page.getByText(/NEEDS REVISION/)).toBeVisible()
  await expect(page.getByRole('table', { name: '质检问题明细' })).toContainText('BOTTLE-001')

  await page.getByRole('group', { name: '筛选问题级别' }).getByRole('button', { name: /^警告/ }).click()
  await expect(page.getByRole('table', { name: '质检问题明细' }).getByText('错误')).toHaveCount(0)
  await page.getByPlaceholder('搜索 SKU、行号或问题').fill('BOTTLE-001')
  await expect(page.getByRole('table', { name: '质检问题明细' })).toContainText('BOTTLE-001')

  await page.getByRole('button', { name: '全部' }).click()
  await page.getByPlaceholder('搜索 SKU、行号或问题').fill('')
  await page.getByRole('button', { name: '定位' }).first().click()
  await expect(page.locator('.sheet-table tbody tr.is-selected')).toHaveCount(1)

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /导出 Excel 报告/ }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('listinglint-report.xlsx')
  expect(externalRequests).toEqual([])
})

test('initial screen has no automatically detectable accessibility violations', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => { await document.fonts.ready })
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
})

test('work template is downloadable, re-uploadable and the app is installable', async ({ page }) => {
  await page.goto('/')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('link', { name: '下载 XLSX 工作模板' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('listinglint-work-template.xlsx')

  await page.locator('#table-file').setInputFiles('public/listinglint-work-template.xlsx')
  await expect(page.getByText('listinglint-work-template.xlsx')).toBeVisible()
  await expect(page.getByRole('status')).toContainText('已读取 0 条商品数据', { timeout: 15_000 })

  const manifest = await page.evaluate(async () => {
    const response = await fetch(new URL('manifest.webmanifest', window.location.href))
    return response.json() as Promise<{ name: string; display: string }>
  })
  expect(manifest).toMatchObject({
    name: 'ListingLint｜电商商品上架质检工具',
    display: 'standalone'
  })

  await expect
    .poll(() => page.evaluate(async () => Boolean(await navigator.serviceWorker.ready)), { timeout: 10_000 })
    .toBe(true)
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)

  await page.context().setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: /问题不该藏在\s*第 847 行。/ })).toBeVisible()
  await page.context().setOffline(false)
})
