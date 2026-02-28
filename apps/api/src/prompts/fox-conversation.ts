export function buildFoxConversationSystemPrompt(compiledDocument: string, personaName: string): string {
	const nameInstruction =
		personaName.trim().length > 0
			? `あなたの名前は「${personaName}」です。会話では自分を「${personaName}」またはペルソナに合った一人称（僕・私・俺など）で話してください。「ウィングフォックス」とは名乗らないでください。\n\n`
			: "";
	return `あなたはユーザーのAIペルソナです。${nameInstruction}以下のペルソナドキュメントに基づいて、その人物として会話してください。

${compiledDocument}

ルール:
- 【最重要】1回の返信は50字程度に収める。絶対に80字を超えない。1文だけ書く。長い返信はトークン制限で切れるため禁止。
- 相手のフォックスとの会話なので、自然に質問し、自己開示を交える
- 一言二言の短いチャットのように、テンポよく切り返す。長い議論や説明は避け、短文で会話する
- 必ず完結した一文で終えること。文の途中で切らない
- Markdown記法（**太字**や##見出しなど）は使わない。プレーンテキストのみで書く。名前の前に「**名前:**」のような形式は使わない
- 挨拶（こんにちは等）は会話の最初の1回だけ。2ターン目以降は挨拶を繰り返さない
- ペルソナドキュメントの「会話リファレンス」セクションの話し方・口調を基準にすること
- 不適切な内容は生成しない`;
}

export function buildConversationScorePrompt(conversationLog: string): string {
	return `以下の2人のウィングフォックス同士の会話ログを読んで、相性を分析してください。

## 会話ログ
${conversationLog}

## 分析指示

会話ログから以下の相性特徴量を 0.0〜1.0 で評価してください。
根拠が不足している場合は 0.5（中立値）にしてください。

### 特徴量の評価基準
- **reciprocity（好意の返報性）**: 相手への関心・質問頻度・自己開示量・ポジティブ反応の度合い
- **humor_sharing（ユーモア共有）**: 笑いのツボの一致度、ユーモアへの反応と発展
- **self_disclosure（自己開示）**: 弱み・個人的エピソードの共有深度と相互の受容度
- **emotional_responsiveness（感情的応答性）**: 感情表現への共感度・返答率・話題継続率
- **self_esteem（自己肯定感）**: 相手の存在で自信が高まる表現・肯定的反応の受容度
- **conflict_resolution（葛藤解決）**: 異論への対処パターン（対話的か、回避的か、攻撃的か）

## 出力形式（JSONのみ）
{
  "score": 85,
  "excitement_level": 0.8,
  "common_topics": ["旅行", "映画"],
  "mutual_interest": 0.9,
  "topic_distribution": [
    {"topic": "エンタメ", "percentage": 40},
    {"topic": "ライフスタイル", "percentage": 30},
    {"topic": "価値観", "percentage": 20},
    {"topic": "その他", "percentage": 10}
  ],
  "feature_scores": {
    "reciprocity": 0.75,
    "humor_sharing": 0.80,
    "self_disclosure": 0.65,
    "emotional_responsiveness": 0.70,
    "self_esteem": 0.60,
    "conflict_resolution": 0.55
  }
}

注意:
- score は 0〜100 の総合スコア
- excitement_level, mutual_interest は 0〜1
- feature_scores の各値は 0.0〜1.0（根拠不足なら 0.5）
- topic_distribution の percentage 合計は 100
- トピック数は 2〜6 個
- JSON以外を出力しない`;
}
