/**
 * EKC Core Types
 * 共通型定義とプラグインインターフェース
 */

// ============================================================================
// 基本グラフ型
// ============================================================================

/**
 * 汎用グラフノード
 * すべてのプラグインで共通の基本構造
 */
export interface GraphNode {
  id: string;
  type: string;
  [key: string]: any;
}

/**
 * 汎用グラフエッジ
 */
export interface GraphEdge {
  id: string;
  type: string;
  source: string;
  target: string;
  [key: string]: any;
}

/**
 * 汎用グラフ構造
 */
export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata?: {
    schema?: string;
    version?: string;
    [key: string]: any;
  };
}

// ============================================================================
// 検証結果型
// ============================================================================

/**
 * 標準Severity型（小文字形式）
 * ESLint/textlint等の業界標準に準拠
 */
export type Severity = 'error' | 'warning' | 'info';

/**
 * レガシーSeverity型（大文字形式）
 * @deprecated 後方互換性のために残されています。新規コードでは Severity を使用してください。
 */
export type LegacySeverity = 'ERROR' | 'WARN' | 'INFO';

/**
 * Severity変換: 小文字 → 大文字
 * プラグイン内部の小文字形式をCore APIの大文字形式に型安全に変換
 *
 * @param severity - プラグイン内部のseverity値 ('error' | 'warning' | 'info')
 * @returns Core API互換のseverity値 ('ERROR' | 'WARN' | 'INFO')
 * @throws Error - 不明なseverity値の場合
 */
export function mapSeverityToLegacy(severity: Severity): LegacySeverity {
  switch (severity) {
    case 'error':
      return 'ERROR';
    case 'warning':
      return 'WARN';
    case 'info':
      return 'INFO';
    default:
      // TypeScriptの exhaustiveness check
      const _exhaustiveCheck: never = severity;
      throw new Error(`Unknown severity value: ${_exhaustiveCheck}`);
  }
}

/**
 * Severity変換: 大文字 → 小文字
 * Core APIの大文字形式をプラグイン内部の小文字形式に型安全に変換
 *
 * @param severity - Core APIのseverity値 ('ERROR' | 'WARN' | 'INFO')
 * @returns プラグイン内部のseverity値 ('error' | 'warning' | 'info')
 * @throws Error - 不明なseverity値の場合
 */
export function mapLegacySeverityToStandard(severity: LegacySeverity): Severity {
  switch (severity) {
    case 'ERROR':
      return 'error';
    case 'WARN':
      return 'warning';
    case 'INFO':
      return 'info';
    default:
      // TypeScriptの exhaustiveness check
      const _exhaustiveCheck: never = severity;
      throw new Error(`Unknown legacy severity value: ${_exhaustiveCheck}`);
  }
}

/**
 * スキーマ検証エラー
 */
export interface ValidationError {
  type: 'node' | 'edge' | 'reference' | 'schema';
  message: string;
  nodeId?: string;
  edgeId?: string;
  severity?: 'error' | 'warning';
}

/**
 * ルール違反（レガシー形式）
 * @deprecated 後方互換性のために残されています。新規コードでは RuleViolationV2 を使用してください。
 */
export interface RuleViolation {
  ruleId: string;
  severity: 'ERROR' | 'WARN' | 'INFO';
  nodeId: string;
  message: string;
  suggestion?: string;
  line?: number;
  column?: number;
}

/**
 * ルール違反（標準形式）
 * 新規プラグインおよびコードではこちらを使用してください
 */
export interface RuleViolationV2 {
  ruleId: string;
  severity: Severity;  // 'error' | 'warning' | 'info'
  nodeId: string;
  message: string;
  suggestion?: string;
  line?: number;
  column?: number;
}

/**
 * Lint結果
 */
export interface LintResult {
  schemaValid: boolean;
  schemaErrors: ValidationError[];
  violations: RuleViolation[];
  plugin: string;
  executionTime?: number;
}

// ============================================================================
// インパクト分析型
// ============================================================================

/**
 * インパクト分析モード
 */
export type ImpactMode = 'strong-only' | 'strong+medium' | 'all';

/**
 * インパクトレベル
 */
export type ImpactLevel = 'strong' | 'medium' | 'weak';

/**
 * インパクト分析オプション
 */
export interface ImpactOptions {
  /** 分析モード */
  mode: ImpactMode;
  /** 最大探索深度 */
  maxDepth?: number;
  /** その他のプラグイン固有オプション */
  [key: string]: any;
}

/**
 * インパクト分析結果ノード
 */
export interface ImpactResultNode {
  /** ノードID */
  nodeId: string;
  /** インパクトレベル */
  impactLevel: ImpactLevel;
  /** ルートノードからの距離 */
  distance: number;
  /** 経由したエッジID */
  viaEdges: string[];
}

/**
 * インパクト分析結果
 */
export interface ImpactResult {
  /** 起点ノードID */
  rootNodeIds: string[];
  /** 影響を受けるノード */
  nodes: ImpactResultNode[];
}

/**
 * インパクト伝播ルール
 * プラグインがインパクト分析の伝播ロジックを定義
 */
export interface ImpactPropagationRule {
  /** 元カテゴリ */
  fromCategory: string;
  /** 先カテゴリ */
  toCategory: string;
  /** 伝播に使用するエッジ種別 */
  edgeTypes: string[];
  /** 影響度の重み (0.0 = 影響なし, 1.0 = 最大影響) */
  weight: number;
}

/**
 * インパクト分析プロファイル
 * プラグインごとに異なるインパクト分析ロジックを提供
 */
export interface ImpactProfile {
  /** プロファイル名 */
  name: string;
  /** プロファイルの説明 */
  description: string;

  /**
   * ノード分類関数
   * ノードをカテゴリに分類（例: "Phase-A", "OEM-Level", "Stakeholder"）
   */
  classifyNode(node: GraphNode): NodeClassification | null;

  /**
   * インパクト伝播ルール
   */
  propagationRules: ImpactPropagationRule[];
}

// ============================================================================
// ノード表示設定型
// ============================================================================

/**
 * ノード分類（表示グループ化用）
 */
export interface NodeClassification {
  /** 分類名（例: "Phase A", "OEM Level", "Requirements" など） */
  category: string;
  /** 分類の説明 */
  description?: string;
  /** 表示順序 */
  order: number;
}

/**
 * ノード表示設定
 */
export interface NodeDisplayConfig {
  /** ノードタイプごとの分類 */
  getNodeClassification?(nodeType: string, node?: GraphNode): NodeClassification | null;

  /** ノードの表示ラベル生成 */
  getNodeLabel?(node: GraphNode): string;

  /** ノードの表示タグ（バッジ）*/
  getNodeTags?(node: GraphNode): Array<{ key: string; value: string }>;

  /** ノードタイプごとのラベルテンプレート（例: "[{id}] {text}" または "{shall_statement}"） */
  labelTemplates?: Record<string, string>;
}

// ============================================================================
// プラグインインターフェース
// ============================================================================

/**
 * Phase固有のルール設定
 */
export interface PhaseRuleConfig {
  rules: Record<string, 'error' | 'warn' | 'info' | 'off'>;
}

/**
 * プラグイン設定
 */
export interface PluginConfig {
  enabled?: boolean;
  profile?: string;
  rules?: Record<string, 'error' | 'warn' | 'info' | 'off'>;
  phases?: Record<string, PhaseRuleConfig>;
  [key: string]: any;
}

/**
 * GraphLintプラグインインターフェース
 * textlintのRuleModuleを参考にしたシンプルな設計
 */
export interface GraphLintPlugin {
  /** プラグイン名（npm package名） */
  name: string;

  /** バージョン */
  version: string;

  /** スキーマ検証 */
  validateSchema(graph: Graph): ValidationError[];

  /** Lintルール実行 */
  lint(graph: Graph, config?: PluginConfig): RuleViolation[];

  /** スキーマ自動検出（オプション） */
  detectSchema?(graph: Graph): boolean;

  /** インパクト分析（オプション） */
  computeImpact?(
    changedNodeIds: string[],
    graph: Graph,
    options: ImpactOptions
  ): ImpactResult;

  /** ノード表示設定（オプション） */
  nodeDisplayConfig?: NodeDisplayConfig;

  /** インパクト分析プロファイル（オプション） */
  impactProfile?: ImpactProfile;

  /** プラグイン説明（オプション） */
  description?: string;
}

// ============================================================================
// コア設定型
// ============================================================================

/**
 * GraphLint設定ファイル（.graphlintrc.json）
 */
export interface GraphLintConfig {
  /** プラグイン設定 */
  plugins?: Record<string, PluginConfig>;

  /** デフォルトプラグイン */
  defaultPlugin?: string;

  /** 自動検出を有効化 */
  autoDetect?: boolean;

  /** 継承する設定 */
  extends?: string;

  /** グローバルルール設定 */
  rules?: Record<string, 'error' | 'warn' | 'info' | 'off'>;

  /** アクティブなPhase（VehicleLifecycleStage または SoftwareLifecycleStage） */
  activePhase?: string;
}

/**
 * Lint実行オプション
 */
export interface LintOptions {
  /** 使用するプラグイン名（明示的指定） */
  plugin?: string;

  /** スキーマ自動検出 */
  autoDetect?: boolean;

  /** プラグイン設定 */
  config?: GraphLintConfig;

  /** 修正モード */
  fix?: boolean;

  /** アクティブなPhase（CLI --phase オプションから指定、config.activePhaseより優先） */
  phase?: string;
}

/**
 * プラグイン登録情報
 */
export interface RegisteredPlugin {
  plugin: GraphLintPlugin;
  config?: PluginConfig;
}

// ============================================================================
// ヘルパー関数
// ============================================================================

/**
 * テンプレート文字列を処理してノードラベルを生成
 * 例: "[{id}] {text}" + node -> "[REQ-001] 車両のOTAすること"
 */
export function applyLabelTemplate(template: string, node: GraphNode): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = (node as any)[key];
    return value !== undefined && value !== null ? String(value) : '';
  });
}

/**
 * Phase固有のルール設定をデフォルトルールとマージ
 * Phase固有のルールがデフォルトルールを上書き
 *
 * @param config - プラグイン設定
 * @param activePhase - アクティブなPhase名（例: "Development", "Production"）
 * @returns マージされたルール設定
 */
export function mergePhaseRules(
  config: PluginConfig,
  activePhase?: string
): Record<string, 'error' | 'warn' | 'info' | 'off'> {
  const defaultRules = config.rules || {};

  // activePhaseが指定されていない、またはphases設定がない場合はデフォルトルールをそのまま返す
  if (!activePhase || !config.phases || !config.phases[activePhase]) {
    return defaultRules;
  }

  // Phase固有のルールでデフォルトルールを上書き
  const phaseRules = config.phases[activePhase].rules;
  return { ...defaultRules, ...phaseRules };
}
