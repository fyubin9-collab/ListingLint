# ListingLint｜电商商品上架质检工具

> A deterministic, browser-local listing quality inspector for cross-border e-commerce teams.

ListingLint 在浏览器本地读取 CSV/XLSX 商品表和可选图片 ZIP，检查缺失字段、重复 SKU、标题长度、价格、库存、币种、禁用词与图片规格，并生成可定位到源表行号的 Excel 报告。

![ListingLint 演示](docs/listinglint-demo.gif)

## 为什么做这个项目

商品表经常有几百到几千行。一个空品牌、一条重复 SKU 或一张尺寸不足的主图，很容易到上架时才暴露。ListingLint 把这些可确定的问题提前变成可复核的清单：同一输入得到同一结果，不调用 AI，也不会自动修改源文件。

## v0.1.0 能做什么

- 读取 UTF-8/UTF-8 BOM CSV 和多工作表 XLSX，单表最多 5,000 行、20MB。
- 自动识别常见中英文字段名，并让用户手动确认映射。
- 检查必填字段、SKU 唯一性与格式、标题长度、禁用词、正数价格、三位大写币种、非负整数库存。
- 读取最大 100MB、1,000 个文件的图片 ZIP；图片按 `SKU.ext` 或 `SKU_数字.ext` 关联。
- 检查缺图、重复文件名、JPG/JPEG/PNG/WebP、单图 10MB、最小 1000×1000px。
- 导入经过 Schema 校验的 JSON 自定义规则包。
- 按错误/警告筛选问题、定位源表行号，并导出三工作表 Excel 报告。
- 下载带字段说明、币种下拉和数值校验的 XLSX 工作模板；在线版本可安装到桌面并缓存静态应用资源。

内置“通用跨境商品规则”仅用于演示确定性规则能力，不代表 Amazon、Shopee 或任何平台的官方要求。

## 快速开始

环境要求：Node.js 24+、pnpm 11+。

```bash
pnpm install
pnpm dev
```

打开终端显示的本地地址，然后点击“直接体验有问题的示例”，无需准备文件即可走通完整流程。

在支持 PWA 的浏览器中，可通过地址栏或浏览器菜单选择“安装 ListingLint”。安装只缓存应用静态文件，不会保存上传的商品表、图片或质检结果。

生产构建：

```bash
pnpm build
pnpm preview
```

## 使用自己的文件

可以先下载并上传 [`examples/listinglint-demo.csv`](examples/listinglint-demo.csv)。该样例会稳定触发重复 SKU、SKU 格式、标题禁用词、价格、币种、库存、品牌和类目等问题，适合检查完整质检与报告导出流程。

1. 上传 `.csv` 或 `.xlsx` 商品表；多工作表文件可选择具体工作表。
2. 检查自动字段映射。ListingLint 不会猜测未识别的列。
3. 如需图片质检，上传 `.zip`。文件名使用 `SKU.jpg`、`SKU_1.jpg`、`SKU_2.png` 等格式。
4. 保留通用规则，或导入自己的 JSON 规则包。
5. 运行质检，在表格中查看标记，并导出 `listinglint-report.xlsx`。

报告包含：

- `概览`：源文件、规则版本、商品数、错误数、警告数和结论。
- `问题明细`：级别、行号、SKU、字段、规则、原因、建议和处理状态。
- `字段映射与规则`：本次映射与完整规则清单，便于复核。

## 自定义规则包

规则包的稳定接口是 `schemaVersion: 1`。项目提供：

- [`examples/custom-rule-pack.json`](examples/custom-rule-pack.json)：可直接修改的示例。
- [`examples/rule-pack.schema.json`](examples/rule-pack.schema.json)：JSON Schema 契约。

支持的规则类型：`required`、`unique`、`length`、`number`、`pattern`、`forbiddenTerms`、`enum`、`image`。规则包不能执行 JavaScript，也不能访问网络。

最小示例：

```json
{
  "schemaVersion": 1,
  "id": "my-store-v1",
  "name": "我的店铺规则",
  "version": "1.0.0",
  "fieldAliases": { "sku": ["商家 SKU"] },
  "rules": [
    { "id": "sku.required", "type": "required", "field": "sku", "severity": "error" }
  ]
}
```

## 隐私与数据边界

- 没有后端、账号、数据库、遥测、远程图片抓取或第三方 AI 请求。
- 用户文件只在当前标签页内存中处理；刷新页面即清空。
- 导出报告只在用户主动点击时生成。
- GitHub Pages 版本和本地版本使用同一套静态代码。

## 技术结构

- React + TypeScript + Vite：单页质检工作台。
- ExcelJS + PapaParse：XLSX/CSV 读取与 Excel 报告导出。
- JSZip：本地图片包解压与索引。
- Zod：规则包运行时校验。
- Vitest + Testing Library + Playwright：规则、组件和完整用户流程测试。

ExcelJS 与 JSZip 均按需加载，访问首页或体验内置示例时不会加载重型文件处理模块。

## 开发与验证

```bash
pnpm lint
pnpm test:run
pnpm build
pnpm test:e2e
```

测试覆盖规则边界、字段映射、CSV/XLSX、图片关联、规则包错误路径、报告内容，以及“载入示例 → 筛选 → 定位 → 导出”的完整流程。

## 暂不支持

账号、云端保存、平台在线接口、远程图片下载、自动修改原表、AI 改写、官方多平台模板、团队权限与批量 API 均不在 v0.1.0 范围内。

## 贡献

规则包、字段别名、测试样例和可复现的问题报告都欢迎贡献。提交前请阅读 [`CONTRIBUTING.md`](CONTRIBUTING.md)。安全问题请按 [`SECURITY.md`](SECURITY.md) 私下报告。

## License

[MIT](LICENSE)
