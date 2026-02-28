# WingFox

## セットアップ

### 前提条件

- [mise](https://mise.jdx.dev/) がインストールされていること

### 手順

1. **mise でツールをインストール**

   プロジェクトルートで以下を実行すると、`.mise.toml` に定義された Node.js と pnpm が自動でインストールされます。

   ```bash
   mise install
   ```

2. **依存関係をインストール**

   ```bash
   pnpm install
   ```

3. **開発サーバーを起動**

   ```bash
   pnpm dev
   ```

   - Web: http://localhost:3000
   - API: 各アプリの設定に従う
