# API 設計

## 基本方針

### ベース URL

全エンドポイントは `/api` プレフィックスを持つ。

### 認証

- 認証が必要なエンドポイントでは `Authorization: Bearer <JWT>` ヘッダーを必須とする
- JWT は Supabase Auth が発行したアクセストークン
- 以下の表で「認証」列が「要」のエンドポイントは認証ミドルウェアを適用

### レスポンス形式

全レスポンスは JSON 形式で返す。

**成功レスポンス:**

```json
{
  "data": { ... }
}
```

**エラーレスポンス:**

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "エラーの説明"
  }
}
```

### 共通エラーコード

| HTTP ステータス | コード | 説明 |
| --- | --- | --- |
| 400 | `BAD_REQUEST` | リクエストパラメータ不正 |
| 401 | `UNAUTHORIZED` | 認証トークンが無効または未指定 |
| 403 | `FORBIDDEN` | アクセス権限がない |
| 404 | `NOT_FOUND` | リソースが見つからない |
| 409 | `CONFLICT` | リソースの状態が競合 |
| 429 | `RATE_LIMITED` | レート制限超過 |
| 500 | `INTERNAL_ERROR` | サーバー内部エラー |

### ページネーション

一覧系エンドポイントでは cursor ベースのページネーションを使用する。

**クエリパラメータ:**

| パラメータ | 型 | デフォルト | 説明 |
| --- | --- | --- | --- |
| limit | integer | 20 | 取得件数（最大 100） |
| cursor | string | - | 次ページの起点（前回レスポンスの `next_cursor`） |

**レスポンス:**

```json
{
  "data": [...],
  "next_cursor": "xxx",
  "has_more": true
}
```

---

## エンドポイント一覧

### 認証 — `/api/auth`

Supabase Auth SDK をクライアント側で直接使用するため、API 側の認証エンドポイントは最小限とする。

| メソッド | パス | 認証 | 説明 |
| --- | --- | --- | --- |
| POST | `/api/auth/callback` | 不要 | Supabase Auth Webhook 受信 |
| DELETE | `/api/auth/account` | 要 | アカウント削除 |

#### POST `/api/auth/callback`

Supabase Auth の Webhook を受信し、ユーザー作成時に `user_profiles` レコードを自動作成する。

**リクエストボディ（Supabase Webhook ペイロード）:**

```json
{
  "type": "INSERT",
  "table": "users",
  "schema": "auth",
  "record": {
    "id": "uuid",
    "email": "user@example.com"
  }
}
```

**処理:** `user_profiles` に新規レコードを INSERT（nickname はメールアドレスのローカルパートで仮設定）

**レスポンス:** `200 OK`

#### DELETE `/api/auth/account`

**処理:** Supabase Admin API でユーザーを削除（CASCADE で関連データも削除）

**レスポンス:**

```json
{ "data": { "message": "Account deleted" } }
```

---

### クイズ — `/api/quiz`

| メソッド | パス | 認証 | 説明 |
| --- | --- | --- | --- |
| GET | `/api/quiz/questions` | 要 | クイズ質問一覧取得 |
| POST | `/api/quiz/answers` | 要 | クイズ回答送信 |
| GET | `/api/quiz/answers` | 要 | 自分のクイズ回答取得 |

#### GET `/api/quiz/questions`

**レスポンス:**

```json
{
  "data": [
    {
      "id": "q1_weekend",
      "category": "性格",
      "question_text": "週末の理想的な過ごし方は？",
      "options": [
        { "value": "friends", "label": "友達と外出" },
        { "value": "home", "label": "家でのんびり" },
        { "value": "explore", "label": "新しい場所を探索" },
        { "value": "sports", "label": "スポーツや運動" }
      ],
      "allow_multiple": false
    }
  ]
}
```

#### POST `/api/quiz/answers`

**リクエストボディ:**

```json
{
  "answers": [
    { "question_id": "q1_weekend", "selected": ["explore"] },
    { "question_id": "q2_travel", "selected": ["rough_plan"] },
    { "question_id": "q4_indoor", "selected": ["movie", "cooking"] }
  ]
}
```

**処理:**
1. 既存回答がある場合は UPSERT
2. `user_profiles.onboarding_status` を `quiz_completed` に更新

**レスポンス:**

```json
{ "data": { "message": "Answers saved", "count": 3 } }
```

**エラー:**
- `400 BAD_REQUEST`: 不正な question_id または selected 値

#### GET `/api/quiz/answers`

**レスポンス:**

```json
{
  "data": [
    { "question_id": "q1_weekend", "selected": ["explore"] },
    { "question_id": "q2_travel", "selected": ["rough_plan"] }
  ]
}
```

---

### スピードデーティング — `/api/speed-dating`

| メソッド | パス | 認証 | 説明 |
| --- | --- | --- | --- |
| POST | `/api/speed-dating/personas` | 要 | 仮想ペルソナ生成 |
| GET | `/api/speed-dating/personas` | 要 | 自分の仮想ペルソナ一覧 |
| POST | `/api/speed-dating/sessions` | 要 | セッション開始 |
| GET | `/api/speed-dating/sessions/:id` | 要 | セッション詳細取得 |
| POST | `/api/speed-dating/sessions/:id/messages` | 要 | メッセージ送信 + AI 応答 |
| POST | `/api/speed-dating/sessions/:id/complete` | 要 | セッション完了 |

#### POST `/api/speed-dating/personas`

クイズ回答をもとに Mistral API で 3 タイプの仮想ペルソナをペルソナドキュメント形式で生成する。ウィングフォックスと同じ `personas` + `persona_sections` テーブルを使用する。

**前提条件:** `onboarding_status` が `quiz_completed` 以降

**処理:**
1. ユーザーのクイズ回答を取得
2. Mistral API で 3 タイプのペルソナドキュメントを生成
3. `personas` テーブルに 3 レコード INSERT（`persona_type` = `virtual_similar` / `virtual_complementary` / `virtual_discovery`）
4. 各ペルソナの適用対象セクションを `persona_sections` に INSERT
5. 全セクションを結合して `compiled_document` を生成

**レスポンス:**

```json
{
  "data": [
    {
      "id": "uuid",
      "persona_type": "virtual_similar",
      "name": "さくら",
      "compiled_document": "---\nname: さくらのペルソナ\n...",
      "sections": [
        {
          "section_id": "core_identity",
          "title": "コアアイデンティティ",
          "content": "25-29歳。好奇心旺盛で、新しいことに挑戦するのが好き。..."
        },
        {
          "section_id": "communication_rules",
          "title": "コミュニケーションルール",
          "content": "### メッセージの特徴\n- 長さ: やや長め..."
        }
      ]
    }
  ]
}
```

**エラー:**
- `409 CONFLICT`: クイズ未完了

#### POST `/api/speed-dating/sessions`

**リクエストボディ:**

```json
{ "persona_id": "uuid" }
```

**処理:**
1. ペルソナの存在確認（自分の `virtual_*` タイプペルソナか）
2. `speed_dating_sessions` に INSERT
3. ペルソナの `compiled_document` をシステムプロンプトとして Mistral API で最初のメッセージを生成
4. 最初のメッセージを `speed_dating_messages` に INSERT

**レスポンス:**

```json
{
  "data": {
    "session_id": "uuid",
    "persona": {
      "id": "uuid",
      "name": "さくら",
      "personality_summary": "..."
    },
    "first_message": {
      "id": "uuid",
      "role": "persona",
      "content": "はじめまして！さくらです。旅行が大好きで...",
      "created_at": "2026-01-01T00:00:00Z"
    }
  }
}
```

#### POST `/api/speed-dating/sessions/:id/messages`

ユーザーメッセージを送信し、ペルソナの応答を Mistral API で生成する。

**リクエストボディ:**

```json
{ "content": "こんにちは！旅行はどこに行くのが好きですか？" }
```

**処理:**
1. ユーザーメッセージを `speed_dating_messages` に INSERT
2. セッションの会話履歴を取得
3. ペルソナの `compiled_document` をシステムプロンプトとして Mistral API で応答を生成
4. 応答を `speed_dating_messages` に INSERT
5. `speed_dating_sessions.message_count` をインクリメント

**レスポンス:**

```json
{
  "data": {
    "user_message": {
      "id": "uuid",
      "role": "user",
      "content": "こんにちは！旅行はどこに行くのが好きですか？",
      "created_at": "2026-01-01T00:00:10Z"
    },
    "persona_message": {
      "id": "uuid",
      "role": "persona",
      "content": "最近は東南アジアにハマっています！特にベトナムの...",
      "created_at": "2026-01-01T00:00:12Z"
    },
    "message_count": 2
  }
}
```

#### POST `/api/speed-dating/sessions/:id/complete`

**処理:**
1. `speed_dating_sessions.status` を `completed` に更新
2. 全セッション完了時は `user_profiles.onboarding_status` を `speed_dating_completed` に更新

**レスポンス:**

```json
{
  "data": {
    "session_id": "uuid",
    "status": "completed",
    "all_sessions_completed": true
  }
}
```

---

### プロフィール — `/api/profiles`

| メソッド | パス | 認証 | 説明 |
| --- | --- | --- | --- |
| POST | `/api/profiles/generate` | 要 | プロフィール自動生成 |
| GET | `/api/profiles/me` | 要 | 自分のプロフィール取得 |
| PUT | `/api/profiles/me` | 要 | プロフィール編集 |
| POST | `/api/profiles/me/confirm` | 要 | プロフィール確定 |
| POST | `/api/profiles/me/reset` | 要 | オンボーディングやり直し |

#### POST `/api/profiles/generate`

クイズ回答 + スピードデーティング会話ログから Mistral API で構造化プロフィールを生成する。

**前提条件:** `onboarding_status` が `speed_dating_completed` 以降

**処理:**
1. クイズ回答と全スピードデーティング会話ログを取得
2. Mistral API にプロフィール生成をリクエスト
3. `profiles` テーブルに UPSERT（既存の場合は version をインクリメント）
4. `user_profiles.onboarding_status` を `profile_generated` に更新

**レスポンス:**

```json
{
  "data": {
    "id": "uuid",
    "basic_info": { "age_range": "25-29", "location": "東京都" },
    "personality_tags": ["好奇心旺盛", "穏やか", "計画的"],
    "personality_analysis": {
      "introvert_extrovert": 0.6,
      "planned_spontaneous": 0.7,
      "logical_emotional": 0.4
    },
    "interests": [
      { "category": "スポーツ", "items": ["サッカー", "ランニング"] }
    ],
    "values": { "work_life_balance": 0.7, "family_oriented": 0.8 },
    "romance_style": {
      "communication_frequency": "毎日連絡したい",
      "ideal_relationship": "お互いの時間も大切にしつつ支え合う関係"
    },
    "communication_style": {
      "message_length": "medium",
      "question_ratio": 0.4,
      "humor_level": 0.6,
      "empathy_level": 0.8
    },
    "lifestyle": { "weekend_activities": ["カフェ巡り", "映画"] },
    "status": "draft",
    "version": 1
  }
}
```

#### GET `/api/profiles/me`

**レスポンス:** 上記と同じ構造のプロフィールデータ。プロフィール未生成の場合は `404 NOT_FOUND`。

#### PUT `/api/profiles/me`

**前提条件:** `status` が `draft`

**リクエストボディ（部分更新）:**

```json
{
  "personality_tags": ["好奇心旺盛", "社交的", "計画的"],
  "interests": [
    { "category": "スポーツ", "items": ["サッカー", "テニス"] }
  ]
}
```

**レスポンス:** 更新後のプロフィール全体

**エラー:**
- `409 CONFLICT`: 確定済みプロフィールは編集不可

#### POST `/api/profiles/me/confirm`

**前提条件:** ペルソナドキュメント（F2-5）が生成済みであること

**処理:**
1. `profiles.status` を `confirmed` に更新
2. `profiles.confirmed_at` を現在時刻に設定
3. `user_profiles.onboarding_status` を `confirmed` に更新
4. マッチング処理をトリガー

**レスポンス:**

```json
{ "data": { "status": "confirmed", "confirmed_at": "2026-01-01T00:00:00Z" } }
```

**エラー:**
- `409 CONFLICT`: ペルソナドキュメント未生成

#### POST `/api/profiles/me/reset`

オンボーディングをやり直す。クイズからやり直しとなる。

**処理:**
1. `user_profiles.onboarding_status` を `not_started` にリセット
2. 既存のプロフィールの `status` は `draft` に戻す
3. 既存のペルソナドキュメントの `version` をインクリメント（次回生成時に上書き）

**レスポンス:**

```json
{ "data": { "message": "Onboarding reset", "onboarding_status": "not_started" } }
```

---

### ペルソナドキュメント — `/api/personas`

ペルソナドキュメント（SKILL.md 形式）の生成・閲覧・編集 API。ウィングフォックスと仮想ペルソナの両方を統一インターフェースで扱う。`persona_type` パラメータで種別を指定する。

| メソッド | パス | 認証 | 説明 |
| --- | --- | --- | --- |
| POST | `/api/personas/wingfox/generate` | 要 | ウィングフォックスのペルソナドキュメント生成 |
| GET | `/api/personas` | 要 | 自分のペルソナ一覧取得 |
| GET | `/api/personas/:personaId` | 要 | ペルソナドキュメント取得 |
| GET | `/api/personas/:personaId/sections` | 要 | セクション一覧取得 |
| GET | `/api/personas/:personaId/sections/:sectionId` | 要 | セクション詳細取得 |
| PUT | `/api/personas/:personaId/sections/:sectionId` | 要 | セクション編集 |
| GET | `/api/personas/section-definitions` | 要 | セクション定義マスタ取得 |

仮想ペルソナの生成は `/api/speed-dating/personas`（既出）で行う。どちらの生成 API も同一の `personas` + `persona_sections` テーブルにデータを作成する。

#### POST `/api/personas/wingfox/generate`

プロフィール（F2-4）+ スピードデーティング会話ログからウィングフォックスのペルソナドキュメントを生成する。

**前提条件:** `onboarding_status` が `profile_generated` 以降

**処理:**
1. 構造化プロフィールと全スピードデーティング会話ログを取得
2. ウィングフォックスに適用対象のセクションを `persona_section_definitions.applicable_persona_types` で特定
3. 各セクションの `generation_prompt` を使用し、Mistral API でセクションごとにドキュメントを生成
4. 「会話リファレンス」セクションは会話ログから特徴的な発言を自動抽出
5. 「制約事項」セクションはシステム固定テンプレートを使用
6. `personas` に UPSERT（`persona_type = 'wingfox'`）
7. 各セクションを `persona_sections` に UPSERT
8. 全セクションを結合して `compiled_document` を生成
9. `user_profiles.onboarding_status` を `persona_generated` に更新

**レスポンス:**

```json
{
  "data": {
    "id": "uuid",
    "persona_type": "wingfox",
    "name": "ゆうきのウィングフォックス",
    "compiled_document": "---\nname: ゆうきのウィングフォックス\n...",
    "version": 1,
    "sections": [
      {
        "section_id": "core_identity",
        "title": "コアアイデンティティ",
        "content": "25-29歳、東京在住のエンジニア。...",
        "source": "auto",
        "editable": true
      },
      {
        "section_id": "conversation_references",
        "title": "会話リファレンス",
        "content": "### リファレンス1: 自己紹介の仕方\n> 「はじめまして！...",
        "source": "auto",
        "editable": false
      }
    ]
  }
}
```

**エラー:**
- `409 CONFLICT`: プロフィール未生成

#### GET `/api/personas`

自分が所有する全ペルソナの一覧を取得する。

**クエリパラメータ:**

| パラメータ | 型 | デフォルト | 説明 |
| --- | --- | --- | --- |
| persona_type | string | - | 種別フィルタ（`wingfox` / `virtual_similar` / `virtual_complementary` / `virtual_discovery`） |

**レスポンス:**

```json
{
  "data": [
    {
      "id": "uuid",
      "persona_type": "wingfox",
      "name": "ゆうきのウィングフォックス",
      "version": 1,
      "created_at": "2026-01-15T00:00:00Z",
      "updated_at": "2026-01-15T00:00:00Z"
    },
    {
      "id": "uuid",
      "persona_type": "virtual_similar",
      "name": "さくら",
      "version": 1,
      "created_at": "2026-01-15T00:00:00Z",
      "updated_at": "2026-01-15T00:00:00Z"
    },
    {
      "id": "uuid",
      "persona_type": "virtual_complementary",
      "name": "はると",
      "version": 1,
      "created_at": "2026-01-15T00:00:00Z",
      "updated_at": "2026-01-15T00:00:00Z"
    },
    {
      "id": "uuid",
      "persona_type": "virtual_discovery",
      "name": "みさき",
      "version": 1,
      "created_at": "2026-01-15T00:00:00Z",
      "updated_at": "2026-01-15T00:00:00Z"
    }
  ]
}
```

#### GET `/api/personas/:personaId`

指定ペルソナのドキュメント全体を取得する。ウィングフォックスでも仮想ペルソナでも同一のレスポンス形式。

**レスポンス:**

```json
{
  "data": {
    "id": "uuid",
    "persona_type": "wingfox",
    "name": "ゆうきのウィングフォックス",
    "compiled_document": "---\nname: ゆうきのウィングフォックス\nversion: 1\n---\n\n# ゆうきのペルソナ\n...",
    "version": 1,
    "created_at": "2026-01-15T00:00:00Z",
    "updated_at": "2026-01-15T00:00:00Z"
  }
}
```

**エラー:**
- `404 NOT_FOUND`: ペルソナが存在しない
- `403 FORBIDDEN`: 他ユーザーのペルソナ

#### GET `/api/personas/:personaId/sections`

指定ペルソナのセクション一覧を取得する。

**レスポンス:**

```json
{
  "data": [
    {
      "id": "uuid",
      "section_id": "core_identity",
      "title": "コアアイデンティティ",
      "content": "25-29歳、東京在住のエンジニア。...",
      "source": "auto",
      "editable": true,
      "updated_at": "2026-01-15T00:00:00Z"
    },
    {
      "id": "uuid",
      "section_id": "constraints",
      "title": "制約事項",
      "content": "- 不適切な内容は生成しない\n...",
      "source": "auto",
      "editable": false,
      "updated_at": "2026-01-15T00:00:00Z"
    }
  ]
}
```

#### GET `/api/personas/:personaId/sections/:sectionId`

指定セクションの詳細を取得する。

**レスポンス:**

```json
{
  "data": {
    "id": "uuid",
    "section_id": "core_identity",
    "title": "コアアイデンティティ",
    "description": "基本的な人物像。年齢層、ライフスタイル、性格の概要",
    "content": "25-29歳、東京在住のエンジニア。\n好奇心旺盛で穏やかな性格。...",
    "source": "auto",
    "editable": true,
    "updated_at": "2026-01-15T00:00:00Z"
  }
}
```

#### PUT `/api/personas/:personaId/sections/:sectionId`

指定セクションの内容を編集する。ウィングフォックスも仮想ペルソナも同一の IF で編集可能。

**前提条件:**
- 対象セクションの `editable` が `true`
- ウィングフォックスの場合: プロフィールが `confirmed` 前であること

**リクエストボディ:**

```json
{
  "content": "25-29歳、東京在住のエンジニア。\n社交的で好奇心旺盛な性格。新しい体験を楽しむタイプ。\n初対面でも自分から話しかけるのが得意。"
}
```

**処理:**
1. `persona_sections` のコンテンツを更新
2. `source` を `manual` に変更
3. 全セクションを再結合して `personas.compiled_document` を再合成
4. `personas.updated_at` を更新

**レスポンス:**

```json
{
  "data": {
    "id": "uuid",
    "section_id": "core_identity",
    "content": "25-29歳、東京在住のエンジニア。\n社交的で好奇心旺盛な性格。...",
    "source": "manual",
    "updated_at": "2026-01-15T01:00:00Z"
  }
}
```

**エラー:**
- `403 FORBIDDEN`: 編集不可のセクション（`conversation_references`, `constraints`）
- `409 CONFLICT`: 確定済みプロフィール（ウィングフォックスの場合のみ）

#### GET `/api/personas/section-definitions`

セクション定義マスタを取得する。

**クエリパラメータ:**

| パラメータ | 型 | デフォルト | 説明 |
| --- | --- | --- | --- |
| persona_type | string | - | 種別フィルタ（指定するとその種別に適用されるセクションのみ返す） |

**レスポンス:**

```json
{
  "data": [
    {
      "id": "core_identity",
      "title": "コアアイデンティティ",
      "description": "基本的な人物像。年齢層、ライフスタイル、性格の概要",
      "sort_order": 1,
      "editable": true,
      "applicable_persona_types": ["wingfox", "virtual_similar", "virtual_complementary", "virtual_discovery"]
    },
    {
      "id": "conversation_references",
      "title": "会話リファレンス",
      "description": "スピードデーティングの実際の発言サンプルと話し方の特徴分析",
      "sort_order": 7,
      "editable": false,
      "applicable_persona_types": ["wingfox"]
    }
  ]
}
```

---

### マッチング — `/api/matching`

| メソッド | パス | 認証 | 説明 |
| --- | --- | --- | --- |
| GET | `/api/matching/results` | 要 | マッチング結果一覧 |
| GET | `/api/matching/results/:id` | 要 | マッチング詳細 |

#### GET `/api/matching/results`

**クエリパラメータ:**

| パラメータ | 型 | デフォルト | 説明 |
| --- | --- | --- | --- |
| limit | integer | 20 | 取得件数 |
| cursor | string | - | ページネーションカーソル |
| status | string | - | ステータスフィルタ |

**レスポンス:**

```json
{
  "data": [
    {
      "id": "uuid",
      "partner": {
        "nickname": "あおい",
        "avatar_url": "https://..."
      },
      "final_score": 85.5,
      "common_tags": ["旅行", "映画", "カフェ巡り"],
      "status": "fox_conversation_completed",
      "fox_conversation_status": "completed",
      "created_at": "2026-01-01T00:00:00Z"
    }
  ],
  "next_cursor": "xxx",
  "has_more": true
}
```

#### GET `/api/matching/results/:id`

**レスポンス:**

```json
{
  "data": {
    "id": "uuid",
    "partner": {
      "nickname": "あおい",
      "avatar_url": "https://..."
    },
    "profile_score": 78.0,
    "conversation_score": 90.3,
    "final_score": 85.5,
    "score_details": {
      "personality": 82,
      "interests": 75,
      "values": 88,
      "communication": 80,
      "lifestyle": 72
    },
    "fox_summary": "共通の旅行好きで話題が盛り上がりました。",
    "status": "fox_conversation_completed",
    "fox_conversation_id": "uuid",
    "partner_fox_chat_id": "uuid",
    "chat_request_status": null,
    "direct_chat_room_id": null
  }
}
```

---

### 代理会話 — `/api/fox-conversations`

| メソッド | パス | 認証 | 説明 |
| --- | --- | --- | --- |
| GET | `/api/fox-conversations/:id` | 要 | 代理会話詳細 |
| GET | `/api/fox-conversations/:id/messages` | 要 | 会話ログ取得 |

代理会話の生成はバッチ処理で実行されるため、ユーザー向けには閲覧系のみ。

#### GET `/api/fox-conversations/:id`

**レスポンス:**

```json
{
  "data": {
    "id": "uuid",
    "match_id": "uuid",
    "status": "completed",
    "total_rounds": 15,
    "current_round": 15,
    "conversation_analysis": {
      "excitement_level": 0.85,
      "common_topics": ["旅行", "映画"],
      "mutual_interest": 0.9
    },
    "started_at": "2026-01-01T00:00:00Z",
    "completed_at": "2026-01-01T00:05:00Z"
  }
}
```

#### GET `/api/fox-conversations/:id/messages`

**クエリパラメータ:**

| パラメータ | 型 | デフォルト | 説明 |
| --- | --- | --- | --- |
| limit | integer | 50 | 取得件数 |
| cursor | string | - | ページネーションカーソル |

**レスポンス:**

```json
{
  "data": [
    {
      "id": "uuid",
      "speaker": "my_fox",
      "content": "はじめまして！最近面白い映画を観まして...",
      "round_number": 1,
      "created_at": "2026-01-01T00:00:00Z"
    },
    {
      "id": "uuid",
      "speaker": "partner_fox",
      "content": "映画好きなんですね！何を観たんですか？",
      "round_number": 1,
      "created_at": "2026-01-01T00:00:01Z"
    }
  ],
  "next_cursor": "xxx",
  "has_more": false
}
```

`speaker` は呼び出したユーザーから見た視点で `my_fox` / `partner_fox` を返す。

---

### パートナーフォックスチャット — `/api/partner-fox-chats`

| メソッド | パス | 認証 | 説明 |
| --- | --- | --- | --- |
| POST | `/api/partner-fox-chats` | 要 | チャット開始 |
| GET | `/api/partner-fox-chats/:id` | 要 | チャット詳細 |
| GET | `/api/partner-fox-chats/:id/messages` | 要 | 会話履歴取得 |
| POST | `/api/partner-fox-chats/:id/messages` | 要 | メッセージ送信 + AI 応答 |

#### POST `/api/partner-fox-chats`

**前提条件:** 対応するマッチの代理会話（Step 1）が `completed`

**リクエストボディ:**

```json
{ "match_id": "uuid" }
```

**処理:**
1. マッチの存在確認と代理会話ステータス確認
2. `partner_fox_chats` に INSERT
3. 相手のフォックスの挨拶メッセージを Mistral API で生成
4. `matches.status` を `partner_chat_started` に更新

**レスポンス:**

```json
{
  "data": {
    "id": "uuid",
    "match_id": "uuid",
    "partner": {
      "nickname": "あおい"
    },
    "first_message": {
      "id": "uuid",
      "role": "fox",
      "content": "こんにちは！あおいのウィングフォックスです。あおいさんのことをいろいろ聞いてくださいね！",
      "created_at": "2026-01-01T00:00:00Z"
    }
  }
}
```

**エラー:**
- `409 CONFLICT`: 代理会話が未完了、または既にチャット開始済み

#### POST `/api/partner-fox-chats/:id/messages`

**リクエストボディ:**

```json
{ "content": "あおいさんは普段どんなことをしているんですか？" }
```

**処理:**
1. ユーザーメッセージを `partner_fox_messages` に INSERT
2. 会話履歴を取得
3. 相手のペルソナドキュメント（`personas.compiled_document`、`persona_type = 'wingfox'`）をシステムプロンプトとして Mistral API で応答生成
4. フォックスの応答を `partner_fox_messages` に INSERT

**レスポンス:**

```json
{
  "data": {
    "user_message": {
      "id": "uuid",
      "role": "user",
      "content": "あおいさんは普段どんなことをしているんですか？",
      "created_at": "2026-01-01T00:00:10Z"
    },
    "fox_message": {
      "id": "uuid",
      "role": "fox",
      "content": "あおいさんは週末になると...",
      "created_at": "2026-01-01T00:00:12Z"
    }
  }
}
```

#### GET `/api/partner-fox-chats/:id/messages`

**クエリパラメータ:** `limit`, `cursor`（共通ページネーション）

**レスポンス:**

```json
{
  "data": [
    {
      "id": "uuid",
      "role": "fox",
      "content": "こんにちは！あおいのウィングフォックスです。",
      "created_at": "2026-01-01T00:00:00Z"
    },
    {
      "id": "uuid",
      "role": "user",
      "content": "こんにちは！あおいさんのことを教えてください。",
      "created_at": "2026-01-01T00:00:10Z"
    }
  ],
  "next_cursor": "xxx",
  "has_more": false
}
```

---

### チャットリクエスト — `/api/chat-requests`

| メソッド | パス | 認証 | 説明 |
| --- | --- | --- | --- |
| POST | `/api/chat-requests` | 要 | チャットリクエスト送信 |
| GET | `/api/chat-requests` | 要 | 受信リクエスト一覧 |
| PUT | `/api/chat-requests/:id` | 要 | リクエスト承認/拒否 |

#### POST `/api/chat-requests`

**前提条件:**
- パートナーフォックスチャット（Step 2）を実施済み
- 同一マッチに対する既存リクエストがない

**リクエストボディ:**

```json
{ "match_id": "uuid" }
```

**処理:**
1. 前提条件の検証
2. `chat_requests` に INSERT（`expires_at` = 現在時刻 + 48 時間）
3. `matches.status` を `direct_chat_requested` に更新
4. 相手ユーザーに通知（Supabase Realtime）

**レスポンス:**

```json
{
  "data": {
    "id": "uuid",
    "match_id": "uuid",
    "status": "pending",
    "expires_at": "2026-01-03T00:00:00Z"
  }
}
```

**エラー:**
- `409 CONFLICT`: Step 2 未実施、または既にリクエスト済み

#### GET `/api/chat-requests`

自分宛の未対応チャットリクエスト一覧を取得する。

**レスポンス:**

```json
{
  "data": [
    {
      "id": "uuid",
      "match_id": "uuid",
      "requester": {
        "nickname": "たけし"
      },
      "final_score": 85.5,
      "status": "pending",
      "expires_at": "2026-01-03T00:00:00Z",
      "created_at": "2026-01-01T00:00:00Z"
    }
  ]
}
```

#### PUT `/api/chat-requests/:id`

**前提条件:** リクエストの `responder_id` が自分

**リクエストボディ:**

```json
{ "action": "accept" }
```

`action`: `accept` | `decline`

**処理（accept の場合）:**
1. `chat_requests.status` を `accepted` に更新
2. `direct_chat_rooms` を作成
3. `matches.status` を `direct_chat_active` に更新

**処理（decline の場合）:**
1. `chat_requests.status` を `declined` に更新

**レスポンス（accept）:**

```json
{
  "data": {
    "request_id": "uuid",
    "status": "accepted",
    "direct_chat_room_id": "uuid"
  }
}
```

**レスポンス（decline）:**

```json
{
  "data": {
    "request_id": "uuid",
    "status": "declined"
  }
}
```

---

### ダイレクトチャット — `/api/direct-chats`

| メソッド | パス | 認証 | 説明 |
| --- | --- | --- | --- |
| GET | `/api/direct-chats` | 要 | チャットルーム一覧 |
| GET | `/api/direct-chats/:id/messages` | 要 | メッセージ履歴取得 |
| POST | `/api/direct-chats/:id/messages` | 要 | メッセージ送信 |
| PUT | `/api/direct-chats/:id/messages/:messageId/read` | 要 | 既読更新 |

#### GET `/api/direct-chats`

自分が参加しているチャットルーム一覧。

**レスポンス:**

```json
{
  "data": [
    {
      "id": "uuid",
      "partner": {
        "nickname": "あおい",
        "avatar_url": "https://..."
      },
      "last_message": {
        "content": "今度一緒にカフェに行きませんか？",
        "created_at": "2026-01-01T12:00:00Z",
        "is_mine": false
      },
      "unread_count": 2,
      "status": "active"
    }
  ]
}
```

#### GET `/api/direct-chats/:id/messages`

**クエリパラメータ:** `limit`, `cursor`（共通ページネーション）

**レスポンス:**

```json
{
  "data": [
    {
      "id": "uuid",
      "sender_id": "uuid",
      "is_mine": false,
      "content": "今度一緒にカフェに行きませんか？",
      "is_read": true,
      "created_at": "2026-01-01T12:00:00Z"
    }
  ],
  "next_cursor": "xxx",
  "has_more": true
}
```

#### POST `/api/direct-chats/:id/messages`

**リクエストボディ:**

```json
{ "content": "いいですね！来週の土曜日はいかがですか？" }
```

**バリデーション:**
- `content` は 1〜1,000 文字
- レート制限: 10 メッセージ/分

**処理:**
1. `direct_chat_messages` に INSERT
2. Supabase Realtime 経由で相手にリアルタイム配信

**レスポンス:**

```json
{
  "data": {
    "id": "uuid",
    "content": "いいですね！来週の土曜日はいかがですか？",
    "created_at": "2026-01-01T12:01:00Z"
  }
}
```

**エラー:**
- `429 RATE_LIMITED`: メッセージ送信レート制限超過

#### PUT `/api/direct-chats/:id/messages/:messageId/read`

**処理:** 指定メッセージまでの全メッセージを既読に更新

**レスポンス:**

```json
{ "data": { "read_count": 3 } }
```

---

### モデレーション — `/api/moderation`

| メソッド | パス | 認証 | 説明 |
| --- | --- | --- | --- |
| POST | `/api/moderation/blocks` | 要 | ユーザーブロック |
| DELETE | `/api/moderation/blocks/:userId` | 要 | ブロック解除 |
| POST | `/api/moderation/reports` | 要 | ユーザー通報 |

#### POST `/api/moderation/blocks`

**リクエストボディ:**

```json
{ "user_id": "uuid" }
```

**処理:**
1. `blocks` テーブルに INSERT
2. 対象ユーザーとのアクティブなチャットルームを `closed` に更新
3. 対象ユーザーとのマッチを非表示に

**レスポンス:**

```json
{ "data": { "message": "User blocked" } }
```

#### DELETE `/api/moderation/blocks/:userId`

**レスポンス:**

```json
{ "data": { "message": "User unblocked" } }
```

#### POST `/api/moderation/reports`

**リクエストボディ:**

```json
{
  "user_id": "uuid",
  "reason": "harassment",
  "description": "不適切なメッセージを送信された",
  "message_id": "uuid"
}
```

**レスポンス:**

```json
{ "data": { "report_id": "uuid", "status": "pending" } }
```

---

## バッチ処理 API（内部用）

以下のエンドポイントは Cloudflare Cron Triggers またはサーバー内部から呼び出される。外部からのアクセスは API キーで保護する。

| メソッド | パス | 説明 |
| --- | --- | --- |
| POST | `/api/internal/matching/execute` | マッチング処理の実行 |
| POST | `/api/internal/fox-conversations/execute` | 代理会話の実行 |
| POST | `/api/internal/chat-requests/expire` | 期限切れリクエストの処理 |

#### POST `/api/internal/matching/execute`

**処理:**
1. `confirmed` ステータスのプロフィールを全取得
2. 各ペアのマッチングスコアを算出
3. スコア上位 10 人を `matches` に INSERT
4. 各マッチに対して `fox_conversations` を作成（`status = pending`）

#### POST `/api/internal/fox-conversations/execute`

**処理:**
1. `status = pending` の `fox_conversations` を取得
2. 各ユーザーのペルソナドキュメント（`personas.compiled_document`、`persona_type = 'wingfox'`）をシステムプロンプトとして使用
3. 各会話について 15 往復のメッセージを Mistral API で生成
4. 会話完了後、スコアを算出し `matches` を更新
5. `fox_conversations.status` を `completed` に更新

#### POST `/api/internal/chat-requests/expire`

**処理:**
1. `status = pending` かつ `expires_at < now()` のリクエストを取得
2. `status` を `expired` に更新
