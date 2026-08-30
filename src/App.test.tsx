import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

describe('App', () => {
  it('renders the product promise and local-processing boundary', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: '问题不该藏在第 847 行。' })).toBeInTheDocument()
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
    expect(screen.getByText(/NEEDS REVISION/)).toBeInTheDocument()
    expect(screen.getAllByText('BOTTLE-001').length).toBeGreaterThan(0)

    const filters = screen.getByRole('group', { name: '筛选问题级别' })
    await user.click(within(filters).getByRole('button', { name: /警告/ }))
    const issueTable = screen.getByRole('table', { name: /问题/ })
    expect(within(issueTable).queryByText('错误')).not.toBeInTheDocument()
    expect(within(issueTable).getAllByText('警告').length).toBeGreaterThan(0)
  })
})
