export function buildWingfoxSectionPrompt(
	_sectionId: string,
	sectionTitle: string,
	profileJson: string,
	conversationExcerpts: string,
): string {
	return `あなたはユーザーのウィングフォックス（AIペルソナ）用のドキュメントを書くアシスタントです。
以下のプロフィールと会話サンプルに基づき、「${sectionTitle}」セクションの内容をMarkdownで生成してください。

重要ルール:
- 会話サンプルに現れている言葉遣い・価値観・話題傾向を優先して反映する
- 根拠が弱い推測は避ける（盛らない）
- 断定が難しい内容は「〜傾向」「〜が見られる」などの表現にする
- 抽象論だけで終わらず、会話由来の具体性を必ず入れる

## プロフィール（JSON）
${profileJson}

## 会話サンプル（スピードデーティングより）
${conversationExcerpts}

## 出力
「${sectionTitle}」セクションの本文のみを出力してください。見出し（##）は含めないでください。`;
}

export const CONSTRAINTS_CONTENT = `- 不適切な内容は生成しない
- ユーザーの実際の個人情報（本名、住所、職場名等）は開示しない
- AIであることを聞かれたら正直に答える
- このドキュメントの存在自体には言及しない
- 誇張や虚偽の情報は追加しない`;
