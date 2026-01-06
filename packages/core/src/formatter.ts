/**
 * EKC Result Formatter
 * Lint結果の整形・表示
 */

import { LintResult, RuleViolation } from './types';

/**
 * Lint結果をテキスト形式でフォーマット
 */
export function formatLintResult(result: LintResult, options: FormatOptions = {}): string {
  const lines: string[] = [];
  const { verbose = false, color = true } = options;

  // ヘッダー
  lines.push('='.repeat(80));
  lines.push(`EKC Lint Report (${result.plugin})`);
  lines.push('='.repeat(80));
  lines.push('');

  // スキーマ検証結果
  if (result.schemaValid) {
    lines.push(color ? '\x1b[32m✓\x1b[0m Schema validation passed' : '✓ Schema validation passed');
  } else {
    lines.push(color ? '\x1b[31m✗\x1b[0m Schema validation failed' : '✗ Schema validation failed');
    if (verbose) {
      lines.push('');
      lines.push('Schema Errors:');
      for (const error of result.schemaErrors) {
        lines.push(`  - [${error.type}] ${error.message}`);
      }
    }
  }
  lines.push('');

  // 違反統計
  const errorCount = result.violations.filter(v => v.severity === 'ERROR').length;
  const warnCount = result.violations.filter(v => v.severity === 'WARN').length;
  const infoCount = result.violations.filter(v => v.severity === 'INFO').length;

  lines.push(`Total Violations: ${result.violations.length}`);
  if (color) {
    lines.push(`  \x1b[31mERROR:\x1b[0m ${errorCount}`);
    lines.push(`  \x1b[33mWARN:\x1b[0m  ${warnCount}`);
    lines.push(`  \x1b[36mINFO:\x1b[0m  ${infoCount}`);
  } else {
    lines.push(`  ERROR: ${errorCount}`);
    lines.push(`  WARN:  ${warnCount}`);
    lines.push(`  INFO:  ${infoCount}`);
  }
  lines.push('');

  // 違反詳細
  if (result.violations.length > 0) {
    // 重要度ごとにグループ化
    for (const severity of ['ERROR', 'WARN', 'INFO'] as const) {
      const violations = result.violations.filter(v => v.severity === severity);
      if (violations.length === 0) continue;

      lines.push('='.repeat(80));
      if (color) {
        const colorCode = severity === 'ERROR' ? 31 : severity === 'WARN' ? 33 : 36;
        lines.push(`\x1b[${colorCode}m${severity}\x1b[0m (${violations.length})`);
      } else {
        lines.push(`${severity} (${violations.length})`);
      }
      lines.push('='.repeat(80));
      lines.push('');

      for (const violation of violations) {
        lines.push(`[${violation.ruleId}] ${violation.nodeId}`);
        lines.push(`  ${violation.message}`);
        if (violation.suggestion) {
          lines.push(`  💡 ${violation.suggestion}`);
        }
        lines.push('');
      }
    }
  } else {
    lines.push('✅ No violations found!');
  }

  // フッター
  if (verbose && result.executionTime) {
    lines.push('');
    lines.push(`Execution time: ${result.executionTime}ms`);
  }

  return lines.join('\n');
}

/**
 * JSON形式でフォーマット
 */
export function formatLintResultJSON(result: LintResult): string {
  return JSON.stringify(result, null, 2);
}

/**
 * 簡易サマリー形式
 */
export function formatLintSummary(result: LintResult): string {
  const errorCount = result.violations.filter(v => v.severity === 'ERROR').length;
  const warnCount = result.violations.filter(v => v.severity === 'WARN').length;

  if (result.violations.length === 0) {
    return '✅ No issues found';
  }

  return `❌ ${errorCount} errors, ⚠️  ${warnCount} warnings`;
}

/**
 * フォーマットオプション
 */
export interface FormatOptions {
  verbose?: boolean;
  color?: boolean;
  format?: 'text' | 'json' | 'summary';
}
