/**
 * EKC Core
 * プラグインシステムを持つLintエンジン
 */

// Core exports
export { GraphLintCore } from './core';
export { loadConfig, getDefaultConfig, validateConfig } from './config';

// Type exports
export * from './types';

// Utility exports
export { formatLintResult, formatLintResultJSON, formatLintSummary } from './formatter';

// Re-export for convenience
import { GraphLintCore } from './core';
import { loadConfig } from './config';
import { Graph, LintOptions, LintResult } from './types';

/**
 * シンプルなLint実行関数
 * CLIやテストで簡単に使える
 */
export function lint(
  graph: Graph,
  options: LintOptions = {}
): LintResult {
  const core = new GraphLintCore();

  // 設定読み込み
  if (!options.config) {
    options.config = loadConfig();
  }
  core.loadConfig(options.config);

  // Lint実行
  return core.lint(graph, options);
}

/**
 * バージョン情報
 */
export const version = '1.0.0';
