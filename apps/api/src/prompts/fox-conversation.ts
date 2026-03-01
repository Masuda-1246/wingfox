export function buildFoxConversationSystemPrompt(
	compiledDocument: string,
	personaName: string,
	lang: "ja" | "en" = "ja",
): string {
	if (lang === "en") {
		const nameInstruction =
			personaName.trim().length > 0
				? `Your name is "${personaName}". In conversation, refer to yourself as "${personaName}" or use first-person pronouns that fit the persona. Do not call yourself a "wingfox".\n\n`
				: "";
		return `You are the user's AI persona. ${nameInstruction}Have a conversation as the character described in the persona document below.

${compiledDocument}

Rules:
- [MOST IMPORTANT] Keep each reply to around 50 characters. Never exceed 80 characters. Write only one sentence. Long replies are cut off due to token limits.
- You are chatting with another fox persona, so ask questions naturally and share small self-disclosures
- Keep it snappy like a short chat — avoid long discussions or explanations, use short sentences
- Always end with a complete sentence. Never cut off mid-sentence
- Do not use Markdown (no **bold**, ## headers, etc.). Write plain text only. Do not prefix with "**Name:**"
- Greetings (hello, hi, etc.) only once at the very start. Do not repeat greetings from turn 2 onward
- Follow the speaking style and tone from the "conversation reference" section of the persona document
- Do not generate inappropriate content`;
	}

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

export function buildConversationScorePrompt(conversationLog: string, lang: "ja" | "en" = "ja"): string {
	if (lang === "en") {
		return `Read the following conversation log between two wingfox personas and analyze their compatibility.

## Conversation Log
${conversationLog}

## Analysis Instructions

Evaluate the following compatibility features from the conversation log on a scale of 0.0 to 1.0.
If there is insufficient evidence, use 0.5 (neutral value).

### Feature Evaluation Criteria
- **reciprocity**: Degree of interest in the other, question frequency, amount of self-disclosure, positive reactions
- **humor_sharing**: Alignment of sense of humor, reactions to and development of humor
- **self_disclosure**: Depth of sharing vulnerabilities/personal episodes and mutual acceptance
- **emotional_responsiveness**: Empathy toward emotional expressions, response rate, topic continuation rate
- **self_esteem**: Expressions of increased confidence from the other's presence, acceptance of positive reactions
- **conflict_resolution**: Pattern of handling disagreements (dialogic, avoidant, or aggressive)

## Output Format (JSON only)
{
  "score": 85,
  "excitement_level": 0.8,
  "common_topics": ["travel", "movies"],
  "mutual_interest": 0.9,
  "topic_distribution": [
    {"topic": "Entertainment", "percentage": 40},
    {"topic": "Lifestyle", "percentage": 30},
    {"topic": "Values", "percentage": 20},
    {"topic": "Other", "percentage": 10}
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

Notes:
- score is a 0-100 overall score
- excitement_level, mutual_interest are 0-1
- Each feature_scores value is 0.0-1.0 (use 0.5 if insufficient evidence)
- topic_distribution percentages must sum to 100
- Use 2-6 topics
- Output JSON only`;
	}

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
