/**
 * EKC Core Engine
 * プラグインレジストリとLint実行エンジン
 */

import {
  Graph,
  GraphLintPlugin,
  GraphLintConfig,
  LintOptions,
  LintResult,
  RegisteredPlugin,
  PluginConfig,
  mergePhaseRules
} from './types';

/**
 * GraphLintコアエンジン
 * textlintのTextlintKernelを参考にしたシンプルな設計
 */
export class GraphLintCore {
  private plugins: Map<string, RegisteredPlugin> = new Map();
  private config: GraphLintConfig = {};

  /**
   * プラグイン登録
   */
  registerPlugin(plugin: GraphLintPlugin, config?: PluginConfig): void {
    this.plugins.set(plugin.name, { plugin, config });
  }

  /**
   * 複数プラグイン一括登録
   */
  registerPlugins(plugins: GraphLintPlugin[], configs?: Record<string, PluginConfig>): void {
    for (const plugin of plugins) {
      const config = configs?.[plugin.name];
      this.registerPlugin(plugin, config);
    }
  }

  /**
   * 設定読み込み
   */
  loadConfig(config: GraphLintConfig): void {
    this.config = config;

    // プラグイン設定を各プラグインに適用
    if (config.plugins) {
      for (const [pluginName, pluginConfig] of Object.entries(config.plugins)) {
        const registered = this.plugins.get(pluginName);
        if (registered) {
          registered.config = { ...registered.config, ...pluginConfig };
        }
      }
    }
  }

  /**
   * Lint実行
   */
  lint(graph: Graph, options: LintOptions = {}): LintResult {
    const startTime = Date.now();

    // 使用するプラグインを決定
    const plugin = this.selectPlugin(graph, options);

    if (!plugin) {
      throw new Error('No plugin available for this graph');
    }

    // プラグイン設定取得
    const pluginConfig = this.getPluginConfig(plugin.plugin.name, options);

    // スキーマ検証
    const schemaErrors = plugin.plugin.validateSchema(graph);

    // Lint実行
    const violations = plugin.plugin.lint(graph, pluginConfig);

    const executionTime = Date.now() - startTime;

    return {
      schemaValid: schemaErrors.length === 0,
      schemaErrors,
      violations,
      plugin: plugin.plugin.name,
      executionTime
    };
  }

  /**
   * 使用するプラグインを選択
   */
  private selectPlugin(graph: Graph, options: LintOptions): RegisteredPlugin | null {
    // 1. 明示的にプラグイン指定されている場合
    if (options.plugin) {
      const plugin = this.plugins.get(options.plugin);
      if (!plugin) {
        throw new Error(`Plugin not found: ${options.plugin}`);
      }
      return plugin;
    }

    // 2. グラフメタデータにスキーマ指定がある場合
    if (graph.metadata?.schema) {
      const plugin = this.findPluginBySchema(graph.metadata.schema);
      if (plugin) {
        return plugin;
      }
    }

    // 3. 自動検出が有効な場合
    if (options.autoDetect || this.config.autoDetect) {
      const plugin = this.detectPlugin(graph);
      if (plugin) {
        return plugin;
      }
    }

    // 4. デフォルトプラグインを使用
    const defaultPluginName = options.config?.defaultPlugin || this.config.defaultPlugin;
    if (defaultPluginName) {
      const plugin = this.plugins.get(defaultPluginName);
      if (plugin) {
        return plugin;
      }
    }

    // 5. 登録されている最初のプラグインを使用
    return Array.from(this.plugins.values())[0] || null;
  }

  /**
   * スキーマ名からプラグインを検索
   */
  private findPluginBySchema(schema: string): RegisteredPlugin | null {
    const normalized = schema.toLowerCase();

    for (const [name, registered] of this.plugins) {
      if (name.includes(normalized) || normalized.includes(name.replace('@ekc/', ''))) {
        return registered;
      }
    }

    return null;
  }

  /**
   * スキーマ自動検出
   */
  private detectPlugin(graph: Graph): RegisteredPlugin | null {
    for (const registered of this.plugins.values()) {
      const { plugin } = registered;

      // detectSchemaメソッドがある場合は使用
      if (plugin.detectSchema && plugin.detectSchema(graph)) {
        return registered;
      }
    }

    return null;
  }

  /**
   * プラグイン設定を取得
   */
  private getPluginConfig(pluginName: string, options: LintOptions): PluginConfig | undefined {
    // オプションで指定された設定を優先
    const optionConfig = options.config?.plugins?.[pluginName];

    // 登録時の設定
    const registeredConfig = this.plugins.get(pluginName)?.config;

    // グローバル設定
    const globalConfig = this.config.plugins?.[pluginName];

    // マージ（優先順: オプション > 登録時 > グローバル）
    const mergedConfig = {
      ...globalConfig,
      ...registeredConfig,
      ...optionConfig
    };

    // アクティブなPhaseを決定（CLI --phase が最優先、次に config.activePhase）
    const activePhase = options.phase || options.config?.activePhase || this.config.activePhase;

    // Phase固有のルール設定をマージ
    if (activePhase) {
      mergedConfig.rules = mergePhaseRules(mergedConfig, activePhase);
    }

    return mergedConfig;
  }

  /**
   * グラフに適したプラグインを取得
   * lint()と同じロジックでプラグインを選択
   */
  getPluginForGraph(graph: Graph, options: LintOptions = {}): GraphLintPlugin | null {
    const plugin = this.selectPlugin(graph, options);
    return plugin ? plugin.plugin : null;
  }

  /**
   * 登録されているプラグイン一覧取得
   */
  getPlugins(): GraphLintPlugin[] {
    return Array.from(this.plugins.values()).map(r => r.plugin);
  }

  /**
   * プラグイン情報取得
   */
  getPluginInfo(pluginName: string): RegisteredPlugin | undefined {
    return this.plugins.get(pluginName);
  }

  /**
   * プラグイン登録解除
   */
  unregisterPlugin(pluginName: string): boolean {
    return this.plugins.delete(pluginName);
  }

  /**
   * すべてのプラグインをクリア
   */
  clearPlugins(): void {
    this.plugins.clear();
  }
}
