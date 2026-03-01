# Fox会話ステータスフロー全体図

## 1. テーブル別ステータス値

### `fox_conversations.status`
| 値 | 意味 |
|---|---|
| `pending` | 作成済み・未開始 |
| `in_progress` | 会話実行中 |
| `completed` | 全ラウンド＋スコア計算完了 |
| `failed` | 失敗 |

### `matches.status` (Fox会話関連のみ)
| 値 | 意味 |
|---|---|
| `pending` | マッチ作成直後 |
| `fox_conversation_in_progress` | Fox会話が実行中 |
| `fox_conversation_completed` | Fox会話が完了 |
| `fox_conversation_failed` | Fox会話が失敗 |
| `partner_chat_started` | パートナーFoxチャット開始 |
| `direct_chat_requested` | ダイレクトチャット申請中 |
| `direct_chat_active` | ダイレクトチャット中 |
| `chat_request_expired` | リクエスト期限切れ |
| `chat_request_declined` | リクエスト辞退 |

---

## 2. アクション → ステータス変更マップ

### A. Fox探索開始 (`handleStartFoxSearch` → `POST /fox-search/start`)

| テーブル | 変更前 | 変更後 | 場所 |
|---|---|---|---|
| `matches` | (新規作成) | `pending` | `services/matching.ts:195` |
| `fox_conversations` | (新規作成) | `pending` | `services/matching.ts:220` |
| `matches` | `pending` | `fox_conversation_in_progress` | `routes/fox-search.ts:216` |

**フロントエンド**: `activeFoxConvMap[matchId] = foxConvId` にセット

### B. デイリーバッチ (`runDailyBatch`)

| タイミング | テーブル | 変更前 | 変更後 | 場所 |
|---|---|---|---|---|
| 各会話開始前 | `matches` | `pending` | `fox_conversation_in_progress` | `daily-batch.ts:118` |
| 会話内部: 開始 | `fox_conversations` | `pending` | `in_progress` | `fox-conversation.ts:103` |
| 会話内部: 完了 | `fox_conversations` | `in_progress` | `completed` | `fox-conversation.ts:347` |
| 会話内部: 完了 | `matches` | `fox_conversation_in_progress` | `fox_conversation_completed` | `fox-conversation.ts:340` |
| 会話内部: ペルソナ欠損 | `fox_conversations` | `pending` | `failed` | `fox-conversation.ts:97` |
| 会話内部: ペルソナ欠損 | `matches` | `fox_conversation_in_progress` | `fox_conversation_failed` | `fox-conversation.ts:98` |
| catch block (throw時) | `fox_conversations` | `in_progress` | `failed` | `daily-batch.ts:133` ★修正済 |
| catch block (throw時) | `matches` | `fox_conversation_in_progress` | `fox_conversation_failed` | `daily-batch.ts:136` ★修正済 |

### C. DO版Fox会話 (`FoxConversationDO`)

| タイミング | テーブル | 変更前 | 変更後 | 場所 |
|---|---|---|---|---|
| handleInit | `fox_conversations` | `pending` | `in_progress` | `fox-conversation-do.ts:141` |
| ペルソナ欠損 | `fox_conversations` | → | `failed` | `fox-conversation-do.ts:130` |
| ペルソナ欠損 | `matches` | → | `fox_conversation_failed` | `fox-conversation-do.ts:133` |
| MAX_RETRIES超過 | `fox_conversations` | → | `failed` | `failConversation()` |
| MAX_RETRIES超過 | `matches` | → | `fox_conversation_failed` | `failConversation()` |
| スコア計算完了 | `fox_conversations` | → | `completed` | `fox-conversation-do.ts:507` |
| スコア計算完了 | `matches` | → | `fox_conversation_completed` | `fox-conversation-do.ts:496` |
| スコア計算失敗 | `fox_conversations` | → | `failed` | `failConversation()` |
| スコア計算失敗 | `matches` | → | `fox_conversation_failed` | `failConversation()` |

### D. 再測定 (`handleRetryFoxConversation` → `POST /fox-search/retry/:matchId`)

| テーブル | 変更前 | 変更後 | 場所 |
|---|---|---|---|
| `fox_conversation_messages` | (既存) | **全削除** | `fox-search.ts:194` |
| `fox_conversations` | `completed`/`failed` | `pending` | `fox-search.ts:196` |
| `matches` | `fox_conversation_completed`/`failed` | `fox_conversation_in_progress` | `fox-search.ts:206` |

**フロントエンド**: `activeFoxConvMap[matchId] = foxConvId` にセット → DO起動

### E. 自己修復 (`GET /matching/results` ポーリング時)

| 条件 | テーブル | 変更前 | 変更後 | 場所 |
|---|---|---|---|---|
| fc.status=completed, match=in_progress | `matches` | `fox_conversation_in_progress` | `fox_conversation_completed` | `matching.ts:79` |
| fc.status=failed, match=in_progress | `matches` | `fox_conversation_in_progress` | `fox_conversation_failed` | `matching.ts:86` |
| fc.status=in_progress | (何もしない) | — | — | `matching.ts:89` ★修正済 |
| fc.status=pending/null + 3分超過 | `fox_conversations` | → | `failed` | `matching.ts:92` |
| fc.status=pending/null + 3分超過 | `matches` | → | `fox_conversation_failed` | `matching.ts:95` |

---

## 3. ステータス → フロントエンド表示マップ

### サイドバー (Chat.tsx 行636-790)

表示判定は2段階:
1. **`activeFoxConvMap[session.id]`** に値があるか（= ライブ追跡中か）
2. なければ **`session.matchStatus`**（= サーバーから返されたmatches.status）で判定

#### `activeFoxConvMap[session.id]` が **ある** 場合（ライブ追跡中）

| `multiStatus.statusMap.get(foxConvId).status` | アバターバッジ | ステータス表示 |
|---|---|---|
| `completed` | 緑ドット | 「完了」バッジ（緑） |
| `failed` | 赤ドット | エラーテキスト（赤） |
| その他 (`in_progress`) | 灰色パルスドット | プログレスバー + `{current}/{total}` |

#### `activeFoxConvMap[session.id]` が **ない** 場合（ライブ追跡なし）

| `session.matchStatus` | 表示 |
|---|---|
| `fox_conversation_in_progress` | スコア欄に「マッチ度測定中」（青パルス） |
| `fox_conversation_failed` | 「会話失敗」バッジ（赤） + **「再測定」ボタン** |
| **`fox_conversation_completed`** | **トピック分布の最も高い項目** |
| `chat_request_expired` | 「リクエスト期限切れ」（黄） |
| `chat_request_declined` | 「リクエスト辞退」（橙） |
| その他 | lastMessage テキスト |

### スコア表示 (行667-677)

| 条件 | 表示 |
|---|---|
| `compatibilityScore != null` | `{score}%` バッジ |
| `matchStatus === "fox_conversation_in_progress"` | 「マッチ度測定中」（青パルス） |
| その他 | `—%` |

---

## 4. 問題の根本原因

### 「測定完了なのに再測定が表示される」問題

**原因**: サイドバーの表示判定が `activeFoxConvMap` のライブ状態に依存しているが、完了後にクリアされる

**フロー**:

```
1. ユーザーが探索/再測定を実行
   → activeFoxConvMap[matchId] = foxConvId (セット)
   → サイドバー: プログレスバー表示 ✓

2. 全会話が完了 (multiStatus.allTerminal = true)
   → Chat.tsx:494: setActiveFoxConvMap({}) → 全クリア
   → マッチ一覧をinvalidateQueries

3. マッチ一覧がリフェッチされる
   → matchStatus = "fox_conversation_completed"
   → activeFoxConvMap[session.id] = undefined

4. サイドバー再描画
   → foxConvId = activeFoxConvMap[session.id] → undefined
   → !foxConvId === true
   → matchStatus === "fox_conversation_completed" → true
   → ★「再測定」ボタンが表示される
```

**問題のコード** (Chat.tsx 行681-727):
```typescript
const foxConvId = activeFoxConvMap[session.id]; // ← activeFoxConvMapのみ参照
if (!foxConvId) {
    // matchStatus === "fox_conversation_completed" → 「再測定」ボタン表示
    // matchStatus === "fox_conversation_failed" → 「会話失敗」+「再測定」ボタン表示
}
```

- `activeFoxConvMap` はライブ追跡用のローカルstate
- 完了後にクリアされる (行494)
- リストア時も `in_progress` のマッチのみ復元 (行180)
- **`fox_conversation_completed` のマッチは永久に `!foxConvId` → 「再測定」ボタン表示**

### 本来の期待動作

| matches.status | 期待する表示 |
|---|---|
| `fox_conversation_in_progress` | 「マッチ度測定中」 |
| `fox_conversation_completed` | スコア表示 + （任意で小さく「再測定」） |
| `fox_conversation_failed` | 「会話失敗」+ 「再測定」ボタン |

現状は `fox_conversation_completed` で **スコアは表示される** (行667-669) が、ステータス行に「再測定」ボタン **だけ** が表示され、「完了」バッジが出ない。

---

## 5. 関連するポーリング設定

| クエリ | ポーリング条件 | 間隔 |
|---|---|---|
| `useMatchingResults` | `hasInProgress` (status含む) | 3秒 |
| `useFoxConversationStatus` | status=`in_progress` | 3秒 |
| `useDailyMatchResults` | batch_status=`pending/matching/conversations_running` | 5秒 |
