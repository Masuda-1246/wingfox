# Scripts

## create-user-with-fox.sh

オンボーディング完了済みのユーザー + FOX（ウィングフォックス）を DB に直接作成するスクリプト。

開発・テスト時に、UI 経由のオンボーディングフロー（ユーザー登録→クイズ→スピードデーティング→FOX 生成）をスキップして、即座に利用可能なユーザーを作成できます。

### 前提条件

- `curl` と `jq` がインストールされていること
- `.mise.local.toml` に `SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` が設定されていること（または環境変数として export されていること）

### 使い方

```bash
# 基本的な使い方（プリセットはランダム選択）
./scripts/create-user-with-fox.sh --email user@test.com --password testpass123

# プリセット指定
./scripts/create-user-with-fox.sh --email outdoor@test.com --password testpass123 --preset outdoor

# 全オプション指定
./scripts/create-user-with-fox.sh \
  --email user@test.com \
  --password testpass123 \
  --nickname テスト太郎 \
  --gender male \
  --birth-year 1995 \
  --preset indoor
```

### オプション

| オプション | 必須 | 説明 | デフォルト |
|-----------|------|------|-----------|
| `--email` | Yes | メールアドレス | - |
| `--password` | Yes | パスワード（6文字以上） | - |
| `--nickname` | No | 表示名 | email の @ 前部分 |
| `--gender` | No | 性別 (`male`/`female`/`other`/`undisclosed`) | `undisclosed` |
| `--birth-year` | No | 誕生年 (1900-2100) | - |
| `--preset` | No | FOX のプリセット | ランダム |
| `-h, --help` | No | ヘルプ表示 | - |

### FOX プリセット

5 種類のプリセットから選択可能。マッチング相性テストに便利です。

| プリセット | タイプ | 特徴 |
|-----------|--------|------|
| `outdoor` | アウトドア活発型 | 外向的、登山・キャンプ好き、毎日連絡 |
| `indoor` | インドア知的型 | 内向的、読書・哲学好き、自立した関係 |
| `social` | 社交バランス型 | バランス型、カフェ・料理好き、適度な距離感 |
| `creative` | クリエイティブ自由型 | 自由奔放、アート好き、束縛NG |
| `family` | 家庭的安定型 | 家庭的、料理・ペット好き、安定志向 |

### マッチング相性の目安

| ペア | 相性 | 理由 |
|------|------|------|
| outdoor × outdoor | 高い | 同じアクティブなライフスタイル |
| social × family | 高い | 協調性が高く価値観が近い |
| outdoor × indoor | 低い | ライフスタイルが真逆 |
| creative × family | 低い | 自由 vs 安定、価値観が大きく異なる |
| indoor × creative | 中程度 | 一人の時間を好む点は共通だが方向性が違う |

### テスト例

```bash
# 相性の高いペア
./scripts/create-user-with-fox.sh --email outdoor1@test.com --password testpass123 --preset outdoor --gender male
./scripts/create-user-with-fox.sh --email outdoor2@test.com --password testpass123 --preset outdoor --gender female

# 相性の低いペア
./scripts/create-user-with-fox.sh --email creative1@test.com --password testpass123 --preset creative --gender male
./scripts/create-user-with-fox.sh --email family1@test.com --password testpass123 --preset family --gender female

# ランダムプリセット
./scripts/create-user-with-fox.sh --email random@test.com --password testpass123
```

### 処理フロー

1. 引数バリデーション + `.mise.local.toml` から環境変数ロード
2. Supabase Auth ユーザー作成（メール確認スキップ）
3. `user_profiles` レコード作成（`onboarding_status: "confirmed"`）
4. `profiles` レコード作成（`status: "confirmed"`、プリセットに応じたデータ）
5. `personas` レコード作成（wingfox、`compiled_document` 付き）
6. `persona_sections` レコード作成（8 セクション一括）

### エラー時の挙動

途中でエラーが発生した場合、作成済みの Auth ユーザーを自動削除します。`ON DELETE CASCADE` により関連テーブルのレコードも自動的にクリーンアップされます。
