import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../db/types";
import { z } from "zod";
import { chatComplete } from "./mistral";
import { buildFoxConversationSystemPrompt } from "../prompts/fox-conversation";
import { buildConversationScorePrompt } from "../prompts/fox-conversation";

const ConversationScoreSchema = z.object({
	score: z.number().min(0).max(100),
	excitement_level: z.number().min(0).max(1),
	common_topics: z.array(z.string()),
	mutual_interest: z.number().min(0).max(1),
	topic_distribution: z.array(
		z.object({
			topic: z.string(),
			percentage: z.number(),
		}),
	),
});

const TOTAL_ROUNDS = 15;

export async function runFoxConversation(
	supabase: SupabaseClient<Database>,
	mistralApiKey: string,
	conversationId: string,
): Promise<void> {
	const { data: conv } = await supabase
		.from("fox_conversations")
		.select("id, match_id, total_rounds")
		.eq("id", conversationId)
		.single();
	if (!conv || conv.total_rounds === 0) {
		console.error(`[runFoxConversation] Conversation not found or total_rounds=0: ${conversationId}`);
		return;
	}
	const { data: match } = await supabase.from("matches").select("user_a_id, user_b_id").eq("id", conv.match_id).single();
	if (!match) {
		console.error(`[runFoxConversation] Match not found for conversation ${conversationId}, match_id=${conv.match_id}`);
		return;
	}
	const [userA, userB] = [match.user_a_id, match.user_b_id];
	const { data: personaA } = await supabase
		.from("personas")
		.select("compiled_document")
		.eq("user_id", userA)
		.eq("persona_type", "wingfox")
		.single();
	const { data: personaB } = await supabase
		.from("personas")
		.select("compiled_document")
		.eq("user_id", userB)
		.eq("persona_type", "wingfox")
		.single();
	if (!personaA?.compiled_document || !personaB?.compiled_document) {
		console.error(`[runFoxConversation] Persona missing for conversation ${conversationId}: personaA=${!!personaA?.compiled_document}, personaB=${!!personaB?.compiled_document}`);
		await supabase.from("fox_conversations").update({ status: "failed" }).eq("id", conversationId);
		await supabase.from("matches").update({ status: "pending" }).eq("id", conv.match_id);
		return;
	}
	await supabase
		.from("fox_conversations")
		.update({ status: "in_progress", started_at: new Date().toISOString() })
		.eq("id", conversationId);
	const systemA = buildFoxConversationSystemPrompt(personaA.compiled_document);
	const systemB = buildFoxConversationSystemPrompt(personaB.compiled_document);
	const history: { speaker: "A" | "B"; content: string }[] = [];
	let currentSpeaker: "A" | "B" = "A";
	for (let round = 1; round <= TOTAL_ROUNDS; round++) {
		const systemPrompt = currentSpeaker === "A" ? systemA : systemB;
		const context = history.length
			? history.map((m) => `相手: ${m.content}`).join("\n\n")
			: "自己紹介と、相手に一言聞いてください。";
		const content = await chatComplete(
			mistralApiKey,
			[
				{ role: "system", content: systemPrompt },
				{ role: "user", content: context },
			],
			{ maxTokens: 300 },
		);
		const speakerUserId = currentSpeaker === "A" ? userA : userB;
		await supabase.from("fox_conversation_messages").insert({
			conversation_id: conversationId,
			speaker_user_id: speakerUserId,
			content: content || "（応答なし）",
			round_number: round,
		});
		await supabase
			.from("fox_conversations")
			.update({ current_round: round })
			.eq("id", conversationId);
		history.push({ speaker: currentSpeaker, content: content || "" });
		currentSpeaker = currentSpeaker === "A" ? "B" : "A";
	}
	const { data: allMsgs } = await supabase
		.from("fox_conversation_messages")
		.select("speaker_user_id, content, round_number")
		.eq("conversation_id", conversationId)
		.order("round_number");
	const logText = (allMsgs ?? [])
		.map((m) => `Round ${m.round_number} (${m.speaker_user_id === userA ? "A" : "B"}): ${m.content}`)
		.join("\n");
	let conversationScore = 50;
	let analysis: Record<string, unknown> = {};
	try {
		const scorePrompt = buildConversationScorePrompt(logText);
		const scoreRaw = await chatComplete(mistralApiKey, [{ role: "user", content: scorePrompt }], {
			maxTokens: 1024,
			responseFormat: { type: "json_object" },
		});
		const parsed = ConversationScoreSchema.parse(JSON.parse(scoreRaw));
		conversationScore = parsed.score;
		analysis = {
			excitement_level: parsed.excitement_level,
			common_topics: parsed.common_topics,
			mutual_interest: parsed.mutual_interest,
			topic_distribution: parsed.topic_distribution,
		};
	} catch (e) {
		console.warn("[runFoxConversation] Score computation failed, using default score(50):", e);
	}
	const { data: matchRow } = await supabase.from("matches").select("profile_score, score_details").eq("id", conv.match_id).single();
	const profileScore = (matchRow?.profile_score as number) ?? 50;
	const existingDetails = (matchRow?.score_details as Record<string, unknown>) ?? {};
	const finalScore = profileScore * 0.4 + conversationScore * 0.6;
	await supabase
		.from("matches")
		.update({
			conversation_score: conversationScore,
			final_score: finalScore,
			score_details: { ...existingDetails, conversation_analysis: analysis } as Json,
			status: "fox_conversation_completed",
			updated_at: new Date().toISOString(),
		})
		.eq("id", conv.match_id);
	await supabase
		.from("fox_conversations")
		.update({
			status: "completed",
			current_round: TOTAL_ROUNDS,
			conversation_analysis: analysis as Json,
			completed_at: new Date().toISOString(),
		})
		.eq("id", conversationId);
}
