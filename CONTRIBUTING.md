# Contributing to ListingLint

感谢你帮助 ListingLint 变得更可靠。这个项目优先接受可验证、确定性强、能用测试复现的改进。

## 开发流程

1. Fork 项目并从 `main` 创建功能分支。
2. 使用 `pnpm install` 安装依赖。
3. 修改范围保持聚焦；规则变化必须补充对应测试。
4. 运行 `pnpm lint`、`pnpm test:run`、`pnpm build` 和相关 E2E。
5. Pull Request 中说明用户场景、输入样例、预期结果和实际验证。

## 贡献规则包

- 使用 `schemaVersion: 1`，从 `examples/custom-rule-pack.json` 复制。
- `id` 必须稳定且唯一；不要用会随文案变化的名称。
- 为平台或国家规则标注适用站点、资料日期和公开来源。
- 不要把通用经验包装成平台官方要求。
- 禁止在 JSON 中嵌入代码、请求地址、令牌或用户数据。
- 新规则包至少提供一条通过样例和一条失败样例。

## 提交规范

推荐使用简洁的 Conventional Commit：

- `feat: add category enum rule`
- `fix: preserve XLSX formula results`
- `test: cover duplicate image basenames`
- `docs: clarify image naming`

## Pull Request 完成标准

- 改动只覆盖声明的需求。
- 新旧测试全部通过，没有跳过或降低断言。
- 错误信息告诉用户发生了什么以及如何修正。
- UI 变更通过键盘、窄屏和 reduced motion 检查。
- 不新增文件上传、遥测或持久化行为。
