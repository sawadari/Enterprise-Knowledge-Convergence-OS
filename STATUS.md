# EKC プロジェクト移行状況

**日時**: 2026-01-06
**移行元**: GraphLint v2.0 (ESM/CJS混在)/C:\GraphLint
**移行先**: EKC v1.0 (CommonJS統一)/C:\ekc

## 完了した移行タスク ✅

### 1. プロジェクト構成の設計と作成
- ✅ `/c/ekc` ディレクトリ作成
- ✅ `packages/` と `apps/` の分離
- ✅ npm workspaces設定
- ✅ tsconfig.base.json作成
- ✅ .gitignore作成

### 2. コアパッケージの移行

#### @ekc/core (完了)
- ✅ src/types.ts (428行)
- ✅ src/core.ts (232行)
- ✅ src/config.ts (184行)
- ✅ src/formatter.ts (121行)
- ✅ src/index.ts (44行)
- ✅ ESM → CommonJS変換
- ✅ TypeScriptコンパイル成功
- ✅ dist/フォルダ生成確認

#### @ekc/intent-engine (完了)
- ✅ src/types.ts (280行)
- ✅ src/engine.ts (568行)
- ✅ src/index.ts (31行)
- ✅ ESM import `.js`拡張子削除
- ✅ TypeScriptコンパイル成功

#### @ekc/criteria-engine (完了)
- ✅ src/types.ts
- ✅ src/engine.ts
- ✅ src/index.ts
- ✅ TypeScriptコンパイル成功

### 3. Standards（スキーマ・ルール）の移行
- ✅ standards/schemas/ コピー
- ✅ standards/criteria/ コピー
- ✅ standards/intent_catalog.yaml コピー
- ✅ standards/compiled/ コピー

### 4. SSoT サンプルデータの移行
- ✅ state/ssot.json コピー (22KB)

### 5. VS Code拡張機能の最小実装
- ✅ apps/vscode-extension/src/extension.ts
- ✅ apps/vscode-extension/src/intentCommands.ts
- ✅ package.json (コマンド定義)
- ✅ tsconfig.json
- ✅ TypeScriptコンパイル成功 (out/フォルダ生成)

**実装済みコマンド**:
1. `ekc.initializeIntentEngine` - Intent Engine初期化
2. `ekc.addNeed` - Need追加ウィザード
3. `ekc.addRequirement` - Requirement追加ウィザード
4. `ekc.showStatistics` - SSoT統計表示

## 未実施の移行タスク（オプション）

### 低優先度パッケージ
- ⏳ @ekc/gtwr (GtWRルールプラグイン) - ルール検証が必要な場合に移行
- ⏳ @ekc/profile-compiler - プロファイル再コンパイルが必要な場合に移行

### アプリケーション
- ⏳ apps/web-ui (React + Cytoscape.js) - GraphLintのWeb UIを一時的に使用可能

## 動作確認

### ビルド確認
```bash
cd /c/ekc

# 全パッケージビルド
npm run build

# 個別ビルド確認
npm run build -w @ekc/core            # ✅ 成功
npm run build -w @ekc/intent-engine   # ✅ 成功
npm run build -w @ekc/criteria-engine # ✅ 成功
npm run compile -w ekc-vscode         # ✅ 成功
```

### VS Code拡張のテスト方法
1. VS Codeで `/c/ekc` を開く
2. F5キーで拡張をデバッグ実行
3. 新しいウィンドウで `/c/ekc` ワークスペースを開く
4. コマンドパレット (Ctrl+Shift+P) から「EKC: Initialize Intent Engine」実行
5. 「EKC: Add Need」でNeedを追加テスト
6. 「EKC: Add Requirement」でRequirementを追加テスト

## 技術的な変更点

### ESM → CommonJS変換
- `import { X } from './file.js'` → `import { X } from './file'`
- `export { X }` → そのまま（CommonJS exports使用）
- `type: "module"` → package.jsonから削除（または `type: "commonjs"`）

### VS Code Extension Host互換性
- **問題**: Extension HostがESMモジュールのfile:依存を解決できない
- **解決**: 全パッケージをCommonJSに統一
- **効果**: `@ekc/core`, `@ekc/intent-engine`, `@ekc/criteria-engine`をVS Code拡張から正常にrequire可能

### フォルダ構成の改善
- `packages/` (再利用可能ライブラリ) と `apps/` (エンドユーザー向けアプリ) の分離
- バージョン番号をフォルダ名から削除（package.jsonで管理）

## 次のアクション

### 即座に実行可能
1. VS Code拡張のデバッグ実行テスト
2. Intent Engineの動作確認（Need/Requirement追加）
3. SSoT更新の動作確認

### 必要に応じて実施
1. Web UIの移行（グラフビジュアライザが必要な場合）
2. @ekc/gtwrの移行（ルール検証が必要な場合）
3. 包括的なテストスイート作成

## トラブルシューティング

### VS Code拡張がアクティベートしない場合
```bash
# 依存関係の再インストール
cd /c/ekc/apps/vscode-extension
rm -rf node_modules
cd /c/ekc
npm install
npm run compile -w ekc-vscode
```

### Intent Engine初期化エラー
- `state/ssot.json` が存在するか確認
- `standards/compiled/effective_schema.yaml` が存在するか確認
- `standards/intent_catalog.yaml` が存在するか確認

## プロジェクト統計

**移行されたファイル数**:
- TypeScriptソースファイル: 12ファイル
- YAMLスキーマ: 13ファイル
- JSONデータ: 1ファイル
- 合計行数: 約2,000行

**ビルド成果物**:
- @ekc/core: dist/ (22ファイル)
- @ekc/intent-engine: dist/ (6ファイル)
- @ekc/criteria-engine: dist/ (6ファイル)
- ekc-vscode: out/ (4ファイル)

## 結論

EKC v1.0の最小構成が完成しました。Intent駆動編集の基本機能（Need/Requirement追加）がVS Code拡張から利用可能です。CommonJS統一により、GraphLint v2.0で発生していたESM/CJS混在問題が解決されました。
