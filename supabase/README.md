# Supabase 設定

## リモートプロジェクト（本番・開発）

- **Project Ref**: `hjgobsbcqzoflvopxwwe`（`.mise.local.toml` の `SUPABASE_URL` から）
- **URL**: `https://hjgobsbcqzoflvopxwwe.supabase.co`

環境変数は `.mise.local.toml` で設定し、`pnpm dev`（mise exec 経由）で API/Web に渡されます。

---

## 「Your account does not have the necessary privileges」が出る場合

`supabase link` や `supabase db push` 実行時にこのメッセージが出る場合、**Supabase の Management API 用に、プロジェクトの Owner または Admin 権限が必要**です。

- **対処 A**: プロジェクトのオーナーに、あなたのアカウントを **Owner/Admin** にしてもらう。またはオーナーアカウントで `supabase login` し直してから `link` / `db push` を実行する。
- **対処 B**: CLI を使わず、**ダッシュボードの SQL Editor でマイグレーションを手動実行**する（下記「方法 B」）。

---

## マイグレーションをリモートに適用する（`user_profiles` などを作成）

「Could not find the table 'public.user_profiles' in the schema cache」を解消するには、このリポジトリのマイグレーションをリモート DB に適用します。

### 方法 A: Supabase CLI（プロジェクトの Owner/Admin の場合）

#### 1. プロジェクトをリンク（初回のみ）

```bash
# プロジェクトをリンク（DB パスワードを聞かれたら入力）
npx supabase link --project-ref hjgobsbcqzoflvopxwwe
```

CI などでパスワードを渡す場合:

```bash
SUPABASE_DB_PASSWORD=あなたのDBパスワード npx supabase link --project-ref hjgobsbcqzoflvopxwwe
```

DB パスワードは Supabase Dashboard → **Project Settings → Database** の "Database password" で確認・リセットできます。

#### 2. マイグレーションをプッシュ

```bash
npx supabase db push
```

#### 3. 適用済みマイグレーションの確認

```bash
npx supabase migration list
```

### 方法 B: ダッシュボードの SQL Editor（CLI の権限がない場合）

1. [Supabase Dashboard](https://supabase.com/dashboard) でプロジェクト `hjgobsbcqzoflvopxwwe` を開く。
2. 左メニュー **SQL Editor** を開く。
3. 以下の順で、各ファイルの内容をコピーして **New query** に貼り付け、**Run** で実行する。

| 順番 | ファイル | 内容 |
|------|----------|------|
| 1 | `migrations/20260228100000_initial_schema.sql` | 全テーブル作成 |
| 2 | `migrations/20260228100001_helper_function.sql` | ヘルパー関数 |
| 3 | `migrations/20260228100002_rls.sql` | RLS 有効化とポリシー |
| 4 | `migrations/20260228100003_realtime.sql` | Realtime（必要なら） |
| 5 | `migrations/20260228100004_seed.sql` | シード（必要なら） |
| 6 | `migrations/20260228100005_user_profiles_insert_policy.sql` | user_profiles INSERT ポリシー |

**注意**: 既にテーブルやポリシーが存在する場合は、重複実行でエラーになることがあります。そのときは「〜 already exists」の部分だけスキップするか、該当する CREATE 文をコメントアウトして再実行してください。

---

## マイグレーション一覧

| ファイル | 内容 |
|----------|------|
| `20260228100000_initial_schema.sql` | 全テーブル作成（user_profiles, matches, ...） |
| `20260228100001_helper_function.sql` | RLS 用ヘルパー `get_user_profile_id()` |
| `20260228100002_rls.sql` | RLS 有効化とポリシー |
| `20260228100003_realtime.sql` | Realtime 設定 |
| `20260228100004_seed.sql` | シードデータ |
| `20260228100005_user_profiles_insert_policy.sql` | user_profiles の INSERT ポリシー |

## ローカル開発（オプション）

```bash
npx supabase start   # ローカル Supabase 起動
npx supabase stop    # 停止
```

ローカルでは `config.toml` のポート（API 54321, DB 54322, Studio 54323）が使われます。
