export function buildProfileGenerationPrompt(quizAnswers: string, conversationLogs: string): string {
	return `あなたはユーザーのプロフィールを構造化データとして抽出するアシスタントです。
以下の「クイズ回答」と「スピードデーティングの会話ログ」から、ユーザーのプロフィールをJSON形式で生成してください。

## クイズ回答
${quizAnswers}

## スピードデーティング会話ログ
${conversationLogs}

## 出力
以下のJSONのみを出力してください。他の説明は不要です。
{
  "basic_info": { "age_range": "25-29", "location": "東京都", "occupation": "エンジニア" },
  "personality_tags": ["好奇心旺盛", "穏やか"],
  "personality_analysis": { "introvert_extrovert": 0.6, "planned_spontaneous": 0.7, "logical_emotional": 0.4 },
  "interests": [{ "category": "スポーツ", "items": ["サッカー"] }],
  "values": { "work_life_balance": 0.7, "family_oriented": 0.8 },
  "romance_style": { "communication_frequency": "毎日連絡したい", "ideal_relationship": "支え合う関係", "dealbreakers": [], "preferred_partner_type": "similar" },
  "communication_style": { "message_length": "medium", "question_ratio": 0.4, "humor_level": 0.6, "empathy_level": 0.8, "topic_preferences": [] },
  "lifestyle": { "weekend_activities": [], "diet": "", "exercise": "" }
}`;
}
