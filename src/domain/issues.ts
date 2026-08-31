import type { LintIssue } from './types'

export function getIssueKey(issue: LintIssue): string {
  return [issue.ruleId, issue.sourceRow ?? 'file', issue.field, issue.sku, issue.code].join('::')
}
