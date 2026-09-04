import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

describe('App', () => {
  it('renders the product promise and local-processing boundary', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: '上架前，把每个问题定位到具体行。' })).toBeInTheDocument()
    expect(screen.getByText('浏览器本地处理')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '下载 XLSX 工作模板' })).toHaveAttribute(
      'href',
      '/listinglint-work-template.xlsx'
    )
    expect(screen.getByRole('link', { name: '下载示例图片 ZIP' })).toHaveAttribute(
      'href',
      '/listinglint-demo-images.zip'
    )
  })

  it('loads the built-in demo, exposes deterministic issues and filters warnings', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '直接体验有问题的示例' }))

    expect(screen.getByRole('heading', { name: '先处理阻止上架的问题' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '下载规则示例' })).toBeInTheDocument()
    expect(screen.getByText('需要修改')).toBeInTheDocument()
    expect(screen.getByText('必填字段已映射 7/7')).toBeInTheDocument()
    expect(screen.getAllByText('BOTTLE-001').length).toBeGreaterThan(0)
    const groupedIssues = screen.getByRole('region', { name: '质检问题明细' })
    expect(within(groupedIssues).getAllByText('BOTTLE-001', { exact: true })).toHaveLength(1)
    expect(within(groupedIssues).getByText('源表第 2、4 行')).toBeInTheDocument()

    const filters = screen.getByRole('group', { name: '筛选问题级别' })
    const warningFilter = within(filters).getByRole('button', { name: /警告/ })
    await user.click(warningFilter)
    const issueList = screen.getByRole('region', { name: '质检问题明细' })
    expect(warningFilter).toHaveAttribute('aria-pressed', 'true')
    expect(within(issueList).queryByText('阻止上架')).not.toBeInTheDocument()
    expect(within(issueList).getAllByText('人工复核').length).toBeGreaterThan(0)
  })

  it('walks a new user through the complete feature tour', async () => {
    const user = userEvent.setup()
    render(<App />)

    const launchButton = screen.getByRole('button', { name: '开始功能导览' })
    expect(screen.getByText('跟着示例走一遍完整质检')).toBeVisible()
    await user.click(launchButton)

    const tour = screen.getByRole('dialog', { name: '准备商品资料' })
    expect(tour).toHaveTextContent('1 / 8')
    expect(tour).toHaveFocus()
    expect(screen.getAllByText('listinglint-demo.csv').length).toBeGreaterThan(0)

    for (const title of [
      '确认字段对应关系',
      '运行上架前质检',
      '从原表查看问题位置',
      '按商品整理问题',
      '定位错误并查看改法'
    ]) {
      await user.click(within(tour).getByRole('button', { name: '下一步' }))
      expect(within(tour).getByRole('heading', { name: title })).toBeInTheDocument()
    }

    expect(screen.getByRole('region', { name: '当前定位问题' })).toBeInTheDocument()
    expect(document.querySelector('.sheet-table tbody tr[aria-selected="true"]')).toBeInTheDocument()

    await user.click(within(tour).getByRole('button', { name: '转到第 8 步：导出复核报告' }))
    expect(within(tour).getByRole('heading', { name: '导出复核报告' })).toBeInTheDocument()
    await user.click(within(tour).getByRole('button', { name: '完成导览' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(launchButton).toHaveFocus())
  })

  it('blocks inspection until every required field is mapped', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '直接体验有问题的示例' }))
    await user.click(screen.getByRole('button', { name: '检查或修改' }))
    await user.selectOptions(
      screen.getByRole('combobox', { name: '品牌（Brand） 对应源表列' }),
      ''
    )

    expect(screen.getByRole('button', { name: '运行 ListingLint' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('还不能运行：请映射品牌。')
    expect(screen.getByText('未映射：品牌')).toBeInTheDocument()
  })

  it('keeps the selected issue explanation visible while locating the source row', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '直接体验有问题的示例' }))
    await user.click(screen.getAllByRole('button', { name: /定位到第/ })[0])

    const reviewPanel = await screen.findByRole('region', { name: '当前定位问题' })
    expect(reviewPanel).toHaveTextContent('发现的问题')
    expect(reviewPanel).toHaveTextContent('建议修改')
    expect(document.querySelector('.sheet-table tbody tr[aria-selected="true"]')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '下一问题 →' })).toBeEnabled()
  })
})
