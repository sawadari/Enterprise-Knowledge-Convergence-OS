# EKC - Enterprise Knowledge Convergence OS

**Intent-driven Requirements Engineering Platform**

## プロジェクト構成

EKCは以下の構成で整理されています：

```
ekc/
├── packages/              # コアライブラリ（再利用可能なパッケージ）
│   ├── core/             # バリデーションエンジン
│   ├── gtwr/             # INCOSE GtWRルールプラグイン
│   ├── intent-engine/    # Intent実行エンジン
│   ├── criteria-engine/  # 品質評価エンジン
│   └── profile-compiler/ # プロファイルコンパイラ
│
├── apps/                 # アプリケーション（エンドユーザー向け）
│   ├── web-ui/           # Webインターフェース（React + Cytoscape.js）
│   └── vscode-extension/ # VS Code拡張機能
│
├── standards/            # スキーマ・ルール定義
│   ├── schemas/          # YAMLスキーマ定義
│   ├── criteria/         # 品質基準定義
│   └── intent-catalog.yaml
│
├── state/                # SSoT（Single Source of Truth）
│   └── ssot.json         # グラフデータ
│
└── examples/             # サンプルデータ
    └── emergency-stop/
```

## 設計思想

### 1. パッケージとアプリの分離

- **packages/**: 再利用可能なライブラリ（他のプロジェクトでも使用可能）
- **apps/**: エンドユーザー向けアプリケーション（EKC特有）

### 2. CommonJS統一

VS Code Extension Hostとの互換性のため、全パッケージをCommonJSで統一。ESM/CJS混在による問題を回避。

### 3. バージョン管理

- フォルダ名にバージョン番号を含めない
- package.jsonで各パッケージのバージョンを管理
- セマンティックバージョニング準拠

## インストール

```bash
cd /c/ekc
npm install
npm run build
```

## 開発

### Web UI起動

```bash
npm run dev:web
```

### VS Code拡張機能のビルド

```bash
npm run build:vscode
```

### 全パッケージのビルド

```bash
npm run build
```

## アーキテクチャ

### 7層モデル（A0-A7）

EKCはEKC-OSアーキテクチャに基づく7層モデルを採用：

- **A0 - Input Layer**: ユーザーのIntent受付
- **A1 - Validation Layer**: Intent検証
- **A2 - Schema Layer**: スキーマ検証
- **A3 - SSoT Layer**: データ永続化
- **A4 - Criteria Layer**: 品質評価
- **A5 - Execution Layer**: アクション実行
- **A6 - Output Layer**: 結果提示
- **A7 - History Layer**: 履歴記録

### コラボレーションモード

1. **Autonomous（自律）**: AIが自動的にIntentを生成・実行
2. **Copilot（副操縦士）**: AIが提案、ユーザーが承認
3. **Manual（手動）**: ユーザーが明示的にIntent発行

## GraphLint v2.0からの移行理由

### 解決した問題

1. **ESM/CJS混在問題**: Extension HostがESMモジュールを解決できない
2. **複雑なパッケージ構成**: 17パッケージ → 7パッケージに簡素化
3. **不明確な責任範囲**: packages/apps分離で明確化
4. **バージョン管理の煩雑さ**: フォルダ名からバージョン削除

### 移行された機能

- ✅ コアバリデーションエンジン
- ✅ Intent駆動編集
- ✅ Criteria評価エンジン
- ✅ Web UIグラフビジュアライザ
- ✅ VS Code統合
- ✅ プロファイルシステム

## ライセンス

MIT

## 技術スタック

- **TypeScript**: 型安全なコード
- **CommonJS**: VS Code互換性
- **npm workspaces**: モノレポ管理
- **React + Vite**: Web UI
- **Cytoscape.js**: グラフ可視化
- **VS Code API**: エディタ統合
