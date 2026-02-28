# Fox対話 実行ステータス解説

## 概要

Fox対話（fox_conversations）は、マッチングされた2人のユーザーのペルソナ同士がAIを介して15ラウンドの仮想会話を行い、相性スコアを算出する機能です。本ドキュメントでは、その実行ステータスの定義・遷移・エラーハンドリングを解説します。

---

## 1. fox_conversations テーブルのステータス

DB制約: `CHECK (status IN ('pending', 'in_progress', 'completed', 'failed'))`

| ステータス | 意味 | 設定タイミング |
|-----------|------|--------------|
| `pending` | 実行待機中 | マッチ作成時（デフォルト値） |
| `in_progress` | 会話実行中（15ラウンド進行中） | Durable Object 初期化時 or `runFoxConversation()` 開始時 |
| `completed` | 会話完了・スコア算出済み | 全ラウンド完了＋スコア計算成功後 |
| `failed` | 実行失敗 | ペルソナ不在、リトライ上限超過、致命的エラー発生時 |

### ステータス遷移図

```
                          ┌──────────────────────────────┐
                          │                              │
                          ▼                              │
  ┌─────────┐     ┌──────────────┐     ┌───────────┐    │
  │ pending │────▶│ in_progress  │────▶│ completed │    │
  └─────────┘     └──────────────┘     └───────────┘    │
       │                 │                               │
       │                 │                               │
       ▼                 ▼                               │
  ┌─────────┐       ┌─────────┐    retry-failed         │
  │ failed  │◀──────│ failed  │────────────────────────▶│
  └─────────┘       └─────────┘   (pending にリセット)
```

---

## 2. 各ステータスの詳細

### `pending`（実行待機中）

- **設定箇所**: `matching.ts` — マッチ作成時に `fox_conversations` レコードを INSERT
- **意味**: 会話がまだ開始されていない。バッチ実行の対象キューに入っている状態
- **次の遷移先**: `in_progress`（正常開始時）/ `failed`（ペルソナ不在時）
- **実行トリガー**: `POST /api/internal/fox-conversations/execute` でpending状態の会話を最大5件取得して実行

```sql
-- 実行対象の取得クエリ
SELECT id FROM fox_conversations WHERE status IN ('pending') LIMIT 5;
```

### `in_progress`（会話実行中）

- **設定箇所**: `fox-conversation-do.ts` の `handleInit()` / `fox-conversation.ts` の `runFoxConversation()`
- **意味**: 15ラウンドの会話が進行中。`current_round` が 0 → 15 まで順に進む
- **次の遷移先**: `completed`（全ラウンド完了時）/ `failed`（エラー時）
- **遷移時の更新**: `started_at` に現在日時がセットされる

```typescript
await supabase.from("fox_conversations").update({
  status: "in_progress",
  started_at: new Date().toISOString(),
}).eq("id", conversationId);
```

**ラウンド進行の仕組み（Durable Object）**:
- Durable Object の alarm API で 500ms 間隔でラウンドを実行
- 各ラウンドで LLM を呼び出し、ペルソナA・Bが交互に発言
- `current_round` はラウンド完了ごとにDBに記録される

### `completed`（会話完了）

- **設定箇所**: `fox-conversation-do.ts` の `computeScores()` / `fox-conversation.ts` の `runFoxConversation()`
- **意味**: 15ラウンドの会話が完了し、相性スコアの算出まで成功した状態
- **終端ステータス**: これ以降のステータス遷移はない
- **遷移時の更新**:
  - `completed_at` に現在日時
  - `current_round` が `TOTAL_ROUNDS`（15）に
  - `conversation_analysis` にスコア分析結果（JSON）が格納

```typescript
await supabase.from("fox_conversations").update({
  status: "completed",
  current_round: TOTAL_ROUNDS,
  conversation_analysis: analysis,
  completed_at: new Date().toISOString(),
}).eq("id", conversationId);
```

**スコア計算の堅牢性**:
- LLM によるスコア計算が失敗した場合でも、**デフォルトスコア 50 を使用して会話自体は completed** になる
- つまり `completed` でも `conversation_analysis` の精度が低い場合がある

### `failed`（実行失敗）

- **設定箇所**: `fox-conversation-do.ts` の `failConversation()` / `fox-conversation.ts` 内のエラーハンドラ
- **意味**: 回復不能なエラーが発生し、会話が中断された状態
- **次の遷移先**: `pending`（手動リトライ時のみ）

**失敗する主なケース**:

| ケース | 遷移パス | 原因 |
|--------|---------|------|
| ペルソナ不在 | `pending` → `failed` | ユーザーのペルソナ（compiled_document）が存在しない |
| リトライ上限超過 | `in_progress` → `failed` | LLM 呼び出しが3回連続で失敗 |
| スコア計算の致命的エラー | `in_progress` → `failed` | computeScores() 内の例外（DO版のみ） |

```typescript
// failConversation() の処理
private async failConversation(supabase, state, reason) {
  state.status = "failed";
  await supabase.from("fox_conversations").update({ status: "failed" }).eq("id", state.conversationId);
  await supabase.from("matches").update({ status: "fox_conversation_failed" }).eq("id", state.matchId);
  this.broadcast({ type: "error", message: reason });
}
```

---

## 3. リトライ機構

### 自動リトライ（Durable Object 内）

各ラウンドの実行に失敗した場合、最大3回まで自動リトライされる。

| 試行 | 待機時間 | 動作 |
|------|---------|------|
| 1回目失敗 | 2秒 | アラーム再設定 |
| 2回目失敗 | 4秒 | アラーム再設定 |
| 3回目失敗 | 6秒 | アラーム再設定 |
| 4回目失敗 | — | `failConversation()` 実行 → `failed` |

### 手動リトライ（管理API）

`POST /api/internal/fox-conversations/retry-failed` を呼ぶことで、`failed` 状態の会話を一括リセットできる。

**処理内容**:
1. `failed` 状態の会話を最大10件取得
2. 既存メッセージを全削除
3. `fox_conversations` を以下にリセット:
   - `status: "pending"`, `current_round: 0`
   - `started_at: null`, `completed_at: null`, `conversation_analysis: null`
4. 対応する `matches` のステータスを `fox_conversation_in_progress` に更新
5. 次回の `execute` 呼び出しで再実行される

---

## 4. 関連テーブルのステータス連動

### matches テーブルとの連動

fox_conversations のステータス変更に連動して、matches テーブルのステータスも更新される。

| fox_conversations | matches | タイミング |
|------------------|---------|----------|
| `pending` | `pending` | マッチ作成時 |
| `in_progress` | `fox_conversation_in_progress` | 会話開始時 |
| `completed` | `fox_conversation_completed` | スコア算出完了時 |
| `failed` | `fox_conversation_failed` | 失敗時 |

**matches のステータスは fox 対話完了後、さらに以下に遷移する可能性がある**:

```
fox_conversation_completed
  ├──▶ partner_chat_started        (パートナーチャット開始)
  ├──▶ direct_chat_requested       (ダイレクトチャットリクエスト送信)
  ├──▶ direct_chat_active          (ダイレクトチャット開始)
  ├──▶ chat_request_expired        (チャットリクエスト期限切れ)
  └──▶ chat_request_declined       (チャットリクエスト拒否)
```

### WebSocket によるリアルタイム通知

Durable Object はステータス変更時に WebSocket で接続中のクライアントに通知を送信する。

```typescript
// 状態メッセージの形式
{
  type: "state",
  status: "in_progress" | "completed" | "failed",
  current_round: number,
  total_rounds: 15,
  messages: [...]
}

// エラーメッセージの形式
{
  type: "error",
  message: "失敗理由"
}
```

---

## 5. DBインデックス

検索パフォーマンス最適化のため、アクティブなステータスに部分インデックスが設定されている。

```sql
CREATE INDEX idx_fox_conversations_status
  ON public.fox_conversations(status)
  WHERE status IN ('pending', 'in_progress');
```

`completed` と `failed` は頻繁に検索されないため、インデックス対象外。

---

## 6. データ整合性チェック

`POST /api/internal/fox-conversations/execute` 内でデータ不整合を検出・修正するロジックが存在する。

| 不整合パターン | 修正アクション |
|--------------|--------------|
| match が `fox_conversation_in_progress` だが fox_conversation レコードが存在しない | match を `fox_conversation_failed` に更新 |
| match が `pending` だが fox_conversation が `failed` | match を `fox_conversation_failed` に更新 |
