/**
 * EKC Config Loader
 * 設定ファイル読み込みとマージ
 */

import * as fs from 'fs';
import * as path from 'path';
import { GraphLintConfig } from './types';

/**
 * 設定ファイル名候補
 */
const CONFIG_FILE_NAMES = [
  '.ekcrc.json',
  '.ekcrc',
  'ekc.config.json',
  '.graphlintrc.json',  // 後方互換性
  '.graphlintrc',       // 後方互換性
  'package.json' // ekcフィールドを探す
];

/**
 * 設定ファイル読み込み
 */
export function loadConfig(configPath?: string): GraphLintConfig {
  let config: GraphLintConfig = {};

  // 明示的にパス指定されている場合
  if (configPath) {
    config = loadConfigFile(configPath);
  } else {
    // カレントディレクトリから設定ファイルを探す
    const foundPath = findConfigFile(process.cwd());
    if (foundPath) {
      config = loadConfigFile(foundPath);
    }
  }

  // extendsの解決
  if (config.extends) {
    const baseConfig = resolveExtends(config.extends);
    config = mergeConfig(baseConfig, config);
  }

  return config;
}

/**
 * 設定ファイルを読み込む
 */
function loadConfigFile(filePath: string): GraphLintConfig {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // package.jsonの場合はekcフィールドを抽出
    if (path.basename(filePath) === 'package.json') {
      const pkg = JSON.parse(content);
      return pkg.ekc || pkg.graphlint || {};
    }

    // JSON形式
    if (filePath.endsWith('.json')) {
      return JSON.parse(content);
    }

    // その他（JSON5やJavaScript対応は将来的に）
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load config from ${filePath}: ${error}`);
  }
}

/**
 * 設定ファイルを探す
 */
function findConfigFile(startDir: string): string | null {
  let currentDir = startDir;

  // ルートディレクトリまで遡る
  while (true) {
    for (const fileName of CONFIG_FILE_NAMES) {
      const configPath = path.join(currentDir, fileName);
      if (fs.existsSync(configPath)) {
        // package.jsonの場合はekcフィールドがあるか確認
        if (fileName === 'package.json') {
          const pkg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
          if (pkg.ekc || pkg.graphlint) {
            return configPath;
          }
        } else {
          return configPath;
        }
      }
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      // ルートディレクトリに到達
      break;
    }
    currentDir = parentDir;
  }

  return null;
}

/**
 * extends指定の解決
 */
function resolveExtends(extendsPath: string): GraphLintConfig {
  // @ekc/config-* 形式のプリセット
  if (extendsPath.startsWith('@ekc/config-')) {
    try {
      // npmパッケージとして読み込み
      const preset = require(extendsPath);
      return preset.default || preset;
    } catch (error) {
      throw new Error(`Failed to load preset: ${extendsPath}`);
    }
  }

  // 相対パスまたは絶対パス
  const resolvedPath = path.resolve(extendsPath);
  return loadConfigFile(resolvedPath);
}

/**
 * 設定をマージ
 */
function mergeConfig(base: GraphLintConfig, override: GraphLintConfig): GraphLintConfig {
  return {
    ...base,
    ...override,
    plugins: {
      ...base.plugins,
      ...override.plugins
    },
    rules: {
      ...base.rules,
      ...override.rules
    }
  };
}

/**
 * デフォルト設定を取得
 */
export function getDefaultConfig(): GraphLintConfig {
  return {
    autoDetect: false,
    plugins: {},
    rules: {}
  };
}

/**
 * 設定の妥当性チェック
 */
export function validateConfig(config: GraphLintConfig): string[] {
  const errors: string[] = [];

  // プラグイン設定のチェック
  if (config.plugins) {
    for (const [pluginName, pluginConfig] of Object.entries(config.plugins)) {
      if (typeof pluginConfig !== 'object') {
        errors.push(`Invalid plugin config for ${pluginName}: expected object`);
      }

      if (pluginConfig.rules) {
        for (const [ruleId, severity] of Object.entries(pluginConfig.rules)) {
          if (!['error', 'warn', 'info', 'off'].includes(severity)) {
            errors.push(`Invalid rule severity for ${pluginName}.${ruleId}: ${severity}`);
          }
        }
      }
    }
  }

  // デフォルトプラグインのチェック
  if (config.defaultPlugin && typeof config.defaultPlugin !== 'string') {
    errors.push('defaultPlugin must be a string');
  }

  return errors;
}
