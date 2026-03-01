# WingFox

## Setup

### Prerequisites

- [mise](https://mise.jdx.dev/) must be installed

### Steps

1. **Install tools with mise**

   Run the following in the project root to automatically install Node.js and pnpm as defined in `.mise.toml`.

   ```bash
   mise install
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Start the development server**

   ```bash
   pnpm dev
   ```

   - Web: http://localhost:3000
   - API: See each app's configuration

## デモ

2分間でアプリを紹介する際のシナリオは [docs/demo-scenario-2min.md](docs/demo-scenario-2min.md) を参照してください。テストアカウントの準備は [scripts/README.md](scripts/README.md) の `create-user-with-fox.sh` を利用できます。

## CI と PR マージブロック

- **pre-commit**: コミット前に `pnpm format` と `pnpm build` が自動で実行されます。
- **CI**: PR を `main` / `develop` に向けると、`.github/workflows/ci.yml` で format check・build・lint が実行されます。
- マージをブロックするには、GitHub のブランチ保護で「CI の status check を必須」にしてください。手順は [.github/REQUIRE_CI_FOR_MERGE.md](.github/REQUIRE_CI_FOR_MERGE.md) を参照してください。
