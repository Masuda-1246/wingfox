export function buildInteractionDnaScoringPrompt(
	sessionTranscripts: { personaType: string; transcript: string }[],
	lang: "ja" | "en",
): string {
	const transcriptsBlock = sessionTranscripts
		.map(
			(s, i) =>
				`### Session ${i + 1} (Persona: ${s.personaType})\n${s.transcript}`,
		)
		.join("\n\n");

	if (lang === "en") {
		return `You are an expert psychologist analyzing speed dating conversations.

You have 3 speed dating session transcripts below. Each session used covert probes embedded in natural conversation:

Probe map (which turns triggered which probes):
- Turn 1: Self-introduction, sets social distance. P-01 (mere exposure) observation starts.
- Turn 2: Values/lifestyle sharing.
- Turn 3: P-04 Humor probe — light joke or metaphor to gauge humor response.
- Turn 4: P-03 Attachment pull-back signal — gentle retreat to observe reaction.
- Turn 5: P-12 Conflict probe — mild disagreement to observe conflict style.
- Turn 6: P-07 Self-disclosure probe — emotional sharing to gauge responsiveness.
- Turn 7: P-08 Synchrony probe — topic jump to test adaptability.
- Turn 8: Wrap-up. P-01 (mere exposure) observation ends.
- Throughout: P-10 Rhythm/physiological — tempo and length variations observed.

For each of the 13 psychological features below, analyze the user's responses across ALL 3 sessions. Cite specific evidence.

Features to score (each 0.0–1.0):
1. mere_exposure — Did the user warm up over time? Compare tone at start vs end across sessions.
2. reciprocity — Did the user return engagement, questions, and emotional effort proportionally?
3. similarity_complementarity — Did the user gravitate toward similar personas or enjoy differences?
4. attachment — How did the user react to pull-back signals (Turn 4)? Secure/anxious/avoidant pattern.
5. humor_sharing — How did the user respond to humor probes (Turn 3)? Did they build on jokes?
6. self_disclosure — How deep did the user go in personal sharing? Surface vs vulnerable.
7. synchrony — Did the user mirror communication style, energy, and topic shifts (Turn 7)?
8. emotional_responsiveness — How did the user react to emotional cues (Turn 6)? Engage or deflect?
9. self_expansion — Did the user show curiosity about new topics and perspectives?
10. self_esteem_reception — How did the user receive compliments and positive feedback?
11. physiological — Did the user match or resist tempo/rhythm variations? (Turn pacing, response length)
12. economic_alignment — Did the user reveal spending/lifestyle values? How aligned across sessions?
13. conflict_resolution — How did the user handle the disagreement probe (Turn 5)? Dialogue/avoid/yield/maintain?

## Transcripts
${transcriptsBlock}

## Output
Return ONLY valid JSON (no markdown, no explanation) in this exact structure:
{
  "features": {
    "mere_exposure": { "score": 0.0-1.0, "confidence": 0.0-1.0, "evidence_turns": [1,2,8], "reasoning": "specific evidence" },
    "reciprocity": { "score": ..., "confidence": ..., "evidence_turns": [...], "reasoning": "..." },
    "similarity_complementarity": { "score": ..., "confidence": ..., "evidence_turns": [...], "reasoning": "..." },
    "attachment": { "score": ..., "confidence": ..., "evidence_turns": [...], "reasoning": "..." },
    "humor_sharing": { "score": ..., "confidence": ..., "evidence_turns": [...], "reasoning": "..." },
    "self_disclosure": { "score": ..., "confidence": ..., "evidence_turns": [...], "reasoning": "..." },
    "synchrony": { "score": ..., "confidence": ..., "evidence_turns": [...], "reasoning": "..." },
    "emotional_responsiveness": { "score": ..., "confidence": ..., "evidence_turns": [...], "reasoning": "..." },
    "self_expansion": { "score": ..., "confidence": ..., "evidence_turns": [...], "reasoning": "..." },
    "self_esteem_reception": { "score": ..., "confidence": ..., "evidence_turns": [...], "reasoning": "..." },
    "physiological": { "score": ..., "confidence": ..., "evidence_turns": [...], "reasoning": "..." },
    "economic_alignment": { "score": ..., "confidence": ..., "evidence_turns": [...], "reasoning": "..." },
    "conflict_resolution": { "score": ..., "confidence": ..., "evidence_turns": [...], "reasoning": "..." }
  },
  "overall_interaction_signature": "1-2 sentence personality summary based on the data",
  "preferred_persona_type": "virtual_similar" or "virtual_complementary" or "virtual_discovery"
}

Scoring rules:
- Score 0.0–1.0 where 0.5 is neutral/average
- Confidence reflects how much evidence exists (low evidence = low confidence, use 0.3–0.5)
- evidence_turns: list turn numbers (1-8) where you observed this feature
- reasoning: cite specific user words or behavioral patterns (keep concise, 1-2 sentences)
- preferred_persona_type: "virtual_similar" if user engaged most with similar persona, "virtual_complementary" if with contrasting, "virtual_discovery" if with novel/unexpected`;
	}

	return `あなたはスピードデーティングの会話を分析する心理学の専門家です。

以下に3つのスピードデーティングセッションのトランスクリプトがあります。各セッションでは自然な会話に埋め込まれた隠れたプローブが使用されています：

プローブマップ（各ターンでどのプローブが発動したか）:
- Turn 1: 自己紹介、社会的距離の設定。P-01（単純接触効果）の観察開始。
- Turn 2: 価値観・生活スタイルの共有。
- Turn 3: P-04 ユーモアプローブ — 軽いジョーク/比喩でユーモア反応を測定。
- Turn 4: P-03 アタッチメント引きシグナル — 穏やかな後退で反応を観察。
- Turn 5: P-12 コンフリクトプローブ — 軽い異論で対立スタイルを観察。
- Turn 6: P-07 自己開示プローブ — 感情的な共有で応答性を測定。
- Turn 7: P-08 シンクロニープローブ — 話題の飛躍で適応力をテスト。
- Turn 8: 締めくくり。P-01（単純接触効果）の観察終了。
- 全体: P-10 リズム/生理的 — テンポと長さの変化を観察。

以下の13の心理的特徴について、3つのセッション全体でユーザーの反応を分析してください。具体的な根拠を引用してください。

スコアリング対象の特徴（各0.0〜1.0）:
1. mere_exposure — ユーザーは時間とともに打ち解けたか？セッション間の冒頭と終盤のトーンを比較。
2. reciprocity — ユーザーは質問・感情的な努力を相応に返したか？
3. similarity_complementarity — 似たペルソナに引かれたか、違いを楽しんだか？
4. attachment — 引きシグナル（Turn 4）への反応は？安定型/不安型/回避型パターン。
5. humor_sharing — ユーモアプローブ（Turn 3）への反応は？ジョークを発展させたか？
6. self_disclosure — 個人的な共有はどこまで深かったか？表面的 vs 脆弱性の開示。
7. synchrony — コミュニケーションスタイル、エネルギー、話題の転換（Turn 7）を同調したか？
8. emotional_responsiveness — 感情的な手がかり（Turn 6）への反応は？関与 vs 回避。
9. self_expansion — 新しいトピックや視点への好奇心を示したか？
10. self_esteem_reception — 褒め言葉やポジティブなフィードバックをどう受け止めたか？
11. physiological — テンポ/リズムの変化に合わせたか抵抗したか？（ターン間隔、返答の長さ）
12. economic_alignment — 消費/生活価値観を明かしたか？セッション間での一貫性。
13. conflict_resolution — 異論プローブ（Turn 5）への対処は？対話型/回避型/譲歩型/自説維持型。

## トランスクリプト
${transcriptsBlock}

## 出力
以下の構造で有効なJSONのみを出力してください（マークダウンや説明は不要）：
{
  "features": {
    "mere_exposure": { "score": 0.0-1.0, "confidence": 0.0-1.0, "evidence_turns": [1,2,8], "reasoning": "具体的な根拠" },
    "reciprocity": { "score": ..., "confidence": ..., "evidence_turns": [...], "reasoning": "..." },
    "similarity_complementarity": { "score": ..., "confidence": ..., "evidence_turns": [...], "reasoning": "..." },
    "attachment": { "score": ..., "confidence": ..., "evidence_turns": [...], "reasoning": "..." },
    "humor_sharing": { "score": ..., "confidence": ..., "evidence_turns": [...], "reasoning": "..." },
    "self_disclosure": { "score": ..., "confidence": ..., "evidence_turns": [...], "reasoning": "..." },
    "synchrony": { "score": ..., "confidence": ..., "evidence_turns": [...], "reasoning": "..." },
    "emotional_responsiveness": { "score": ..., "confidence": ..., "evidence_turns": [...], "reasoning": "..." },
    "self_expansion": { "score": ..., "confidence": ..., "evidence_turns": [...], "reasoning": "..." },
    "self_esteem_reception": { "score": ..., "confidence": ..., "evidence_turns": [...], "reasoning": "..." },
    "physiological": { "score": ..., "confidence": ..., "evidence_turns": [...], "reasoning": "..." },
    "economic_alignment": { "score": ..., "confidence": ..., "evidence_turns": [...], "reasoning": "..." },
    "conflict_resolution": { "score": ..., "confidence": ..., "evidence_turns": [...], "reasoning": "..." }
  },
  "overall_interaction_signature": "データに基づく1〜2文の性格要約",
  "preferred_persona_type": "virtual_similar" または "virtual_complementary" または "virtual_discovery"
}

スコアリングルール:
- スコアは0.0〜1.0（0.5が中立/平均）
- confidence（信頼度）は根拠の量を反映（根拠が少ない場合は0.3〜0.5の低い値を使用）
- evidence_turns: その特徴を観察したターン番号（1-8）のリスト
- reasoning: ユーザーの具体的な発言や行動パターンを引用（簡潔に1〜2文）
- preferred_persona_type: 似たペルソナと最も engagement が高かった場合 "virtual_similar"、対照的なペルソナの場合 "virtual_complementary"、新規性のあるペルソナの場合 "virtual_discovery"`;
}
