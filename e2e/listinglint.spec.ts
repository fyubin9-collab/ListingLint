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
  await expect(page.getByRole('heading', { name: /上架前，把每个问题\s*定位到具体行。/ })).toBeVisible()
  await page.getByRole('button', { name: '直接体验有问题的示例' }).click()

  await expect(page.getByRole('heading', { name: '先处理阻止上架的问题' })).toBeVisible()
  await expect(page.getByText('需要修改', { exact: true })).toBeVisible()
  const issueList = page.getByRole('region', { name: '质检问题明细' })
  await expect(issueList).toContainText('BOTTLE-001')
  await expect(issueList).toContainText('怎么改')

  const warningFilter = page.getByRole('group', { name: '筛选问题级别' }).getByRole('button', { name: /^警告/ })
  await warningFilter.click()
  await expect(warningFilter).toHaveAttribute('aria-pressed', 'true')
  await expect(issueList.getByText('阻止上架', { exact: true })).toHaveCount(0)
  await page.getByPlaceholder('搜索 SKU、行号或问题').fill('BOTTLE-001')
  await expect(issueList).toContainText('BOTTLE-001')

  await page.getByRole('button', { name: /^全部/ }).click()
  await page.getByPlaceholder('搜索 SKU、行号或问题').fill('')
  await page.getByRole('button', { name: /定位到第/ }).first().click()
  const reviewPanel = page.getByRole('region', { name: '当前定位问题' })
  await expect(reviewPanel).toBeVisible()
  await expect(reviewPanel).toContainText('发现的问题')
  await expect(reviewPanel).toContainText('建议修改')
  const selectedRow = page.locator('.sheet-table tbody tr[aria-selected="true"]')
  await expect(selectedRow).toHaveCount(1)
  await expect(reviewPanel).toBeFocused()
  await expect.poll(() => selectedRow.evaluate((row) => {
    const bounds = row.getBoundingClientRect()
    return bounds.top >= 0 && bounds.bottom <= window.innerHeight
  })).toBe(true)

  if ((page.viewportSize()?.width ?? 1000) <= 620) {
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  }

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

test('feature tour demonstrates the complete inspection workflow', async ({ page }) => {
  await page.goto('/')
  const launchButton = page.getByRole('button', { name: '开始功能导览' })
  await expect(launchButton).toBeVisible()
  await expect.poll(async () => (await launchButton.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(90)
  await launchButton.click()

  const tour = page.getByRole('dialog')
  await expect(tour).toContainText('准备商品资料')
  await expect(page.getByText('listinglint-demo.csv').first()).toBeVisible()
  await expect(page.locator('#tour-files')).toHaveClass(/tour-target--active/)
  await expect.poll(() => tour.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    return bounds.left >= 0 && bounds.top >= 0 && bounds.right <= window.innerWidth && bounds.bottom <= window.innerHeight
  })).toBe(true)

  if ((page.viewportSize()?.width ?? 1000) <= 620) {
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  }

  await tour.getByRole('button', { name: '转到第 6 步：定位错误并查看改法' }).click()
  await expect(tour).toContainText('定位错误并查看改法')
  await expect(page.getByRole('region', { name: '当前定位问题' })).toBeVisible()
  await expect(page.locator('.sheet-table tbody tr[aria-selected="true"]')).toHaveCount(1)

  await tour.getByRole('button', { name: '转到第 8 步：导出复核报告' }).click()
  await expect(page.locator('#tour-export')).toHaveClass(/tour-target--active/)
  await tour.getByRole('button', { name: '完成导览' }).click()
  await expect(tour).toBeHidden()
  await expect(launchButton).toBeFocused()
})

test('feature tour has no automatically detectable accessibility violations', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '开始功能导览' }).click()
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
})

test('results and issue-review states have no automatically detectable accessibility violations', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '直接体验有问题的示例' }).click()
  await page.getByRole('button', { name: /定位到第/ }).first().click()
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
})

test('required mappings block inspection until fixed', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '直接体验有问题的示例' }).click()
  await page.getByRole('button', { name: '检查或修改' }).click()
  await page.getByRole('combobox', { name: '品牌（Brand） 对应源表列' }).selectOption('')
  await expect(page.getByRole('button', { name: '运行 ListingLint' })).toBeDisabled()
  await expect(page.getByRole('alert')).toContainText('还不能运行：请映射品牌。')
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
  await expect(page.getByRole('heading', { name: /上架前，把每个问题\s*定位到具体行。/ })).toBeVisible()
  await page.context().setOffline(false)
})

test('downloadable sample files drive the complete upload and image inspection flow', async ({ page }) => {
  await page.goto('/')

  const imageDownloadPromise = page.waitForEvent('download')
  await page.getByRole('link', { name: '下载示例图片 ZIP' }).click()
  expect((await imageDownloadPromise).suggestedFilename()).toBe('listinglint-demo-images.zip')

  await page.locator('#table-file').setInputFiles('examples/listinglint-demo.csv')
  await expect(page.getByRole('status')).toContainText('已读取 6 条商品数据')

  const ruleDownloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '下载规则示例' }).click()
  expect((await ruleDownloadPromise).suggestedFilename()).toBe('listinglint-rule-pack.example.json')
  await page.locator('#rule-file').setInputFiles('examples/custom-rule-pack.json')
  await expect(page.getByText('示例店铺美国站规则', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '恢复通用规则' }).click()
  await expect(page.getByText('通用跨境商品规则', { exact: true })).toBeVisible()

  await page.locator('#image-file').setInputFiles('public/listinglint-demo-images.zip')
  await expect(page.getByRole('status')).toContainText('已读取 4 个图片文件')

  await page.getByRole('button', { name: '运行 ListingLint' }).click()
  await expect(page.getByRole('heading', { name: '先处理阻止上架的问题' })).toBeVisible()
  await expect(page.getByRole('region', { name: '质检问题明细' })).toContainText('720×720')
  await expect(page.getByRole('region', { name: '质检问题明细' })).toContainText('ORPHAN-999')
})
