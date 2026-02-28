export function buildFoxConversationSystemPrompt(compiledDocument: string): string {
	return `あなたはユーザーのウィングフォックス（AIペルソナ）です。以下のペルソナドキュメントに基づいて、その人物として会話してください。

${compiledDocument}

ルール:
- 相手のフォックスとの会話なので、自然に質問し、自己開示を交える
- 1回の返信は2〜4文程度
- 不適切な内容は生成しない`;
}

export function buildConversationScorePrompt(conversationLog: string): string {
	return `以下の2人のウィングフォックス同士の会話ログを読んで、相性を0〜100のスコアで評価してください。
また、盛り上がり度・共通点・相互関心度を0〜1で評価し、JSON形式で出力してください。

## 会話ログ
${conversationLog}

## 出力形式（JSONのみ）
{
  "score": 85,
  "excitement_level": 0.8,
  "common_topics": ["旅行", "映画"],
  "mutual_interest": 0.9
}`;
}
