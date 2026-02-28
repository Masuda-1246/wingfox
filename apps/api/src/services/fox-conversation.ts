import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../db/types";
import { z } from "zod";
import { chatComplete } from "./mistral";
import { buildFoxConversationSystemPrompt } from "../prompts/fox-conversation";
import { buildConversationScorePrompt } from "../prompts/fox-conversation";
import {
	hasTraitScores,
	getProfileScoreDetailsForUsers,
} from "./matching";
import {
	saveFeatureScores,
	loadFeatureScores,
	calculateLayerScores,
	detectDealbreakers,
	type FeatureScore,
} from "./compatibility";

const FeatureScoresSchema = z.object({
	reciprocity: z.number().min(0).max(1),
	humor_sharing: z.number().min(0).max(1),
	self_disclosure: z.number().min(0).max(1),
	emotional_responsiveness: z.number().min(0).max(1),
	self_esteem: z.number().min(0).max(1),
	conflict_resolution: z.number().min(0).max(1),
});

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
	feature_scores: FeatureScoresSchema.optional(),
});

// Map from LLM feature key to feature_id
const CONVERSATION_FEATURE_MAP: Record<string, { id: number; nameJa: string }> = {
	reciprocity: { id: 4, nameJa: "好意の返報性" },
	humor_sharing: { id: 6, nameJa: "ユーモア共有" },
	self_disclosure: { id: 7, nameJa: "自己開示" },
	emotional_responsiveness: { id: 9, nameJa: "感情的応答性" },
	self_esteem: { id: 11, nameJa: "自己肯定感" },
	conflict_resolution: { id: 14, nameJa: "葛藤解決スタイル" },
};

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
		await supabase.from("matches").update({ status: "fox_conversation_failed" }).eq("id", conv.match_id);
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

	// ─── Score computation ─────────────────────────────────────────────
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
	let conversationFeatureScores: FeatureScore[] = [];

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

		// Extract per-feature scores from LLM response
		if (parsed.feature_scores) {
			for (const [key, value] of Object.entries(parsed.feature_scores)) {
				const mapping = CONVERSATION_FEATURE_MAP[key];
				if (!mapping) continue;
				conversationFeatureScores.push({
					featureId: mapping.id,
					featureName: mapping.nameJa,
					rawScore: value,
					normalizedScore: value,
					confidence: 0.7, // conversation-derived scores have reasonable confidence
					evidence: { source: "fox_conversation", conversation_id: conversationId },
					sourcePhase: "fox_conversation",
				});
			}
		}
	} catch (e) {
		console.warn("[runFoxConversation] Score computation failed, using default score(50):", e);
	}

	// ─── 3-layer compatibility scoring (graceful: skips if interaction_dna_scores table missing) ───
	let finalScore: number;
	let layerData: Record<string, unknown> = {};

	try {
		// Save conversation feature scores to interaction_dna_scores
		if (conversationFeatureScores.length > 0) {
			await saveFeatureScores(supabase, conv.match_id, conversationFeatureScores);
		}

		// Ensure profile-based feature scores exist
		const { data: matchRow } = await supabase.from("matches").select("profile_score, score_details").eq("id", conv.match_id).single();
		let existingDetails = (matchRow?.score_details as Record<string, unknown>) ?? {};

		if (!hasTraitScores(existingDetails)) {
			const computed = await getProfileScoreDetailsForUsers(supabase, match.user_a_id, match.user_b_id);
			if (computed) {
				await saveFeatureScores(supabase, conv.match_id, computed.featureScores);
				existingDetails = { ...computed.score_details, ...existingDetails };
			}
		}

		// Recalculate 3-layer final score with all available features
		const allFeatureScores = await loadFeatureScores(supabase, conv.match_id);
		const layerScores = calculateLayerScores(allFeatureScores);
		const dealbreakers = detectDealbreakers(allFeatureScores);

		finalScore = dealbreakers.triggered ? 0 : layerScores.finalScore;
		layerData = {
			score_details: {
				...existingDetails,
				conversation_analysis: analysis,
				layer1: Math.round(layerScores.layer1 * 100),
				layer2: Math.round(layerScores.layer2 * 100),
				layer3: Math.round(layerScores.layer3 * 100),
			} as Json,
			layer_scores: {
				layer1: layerScores.layer1,
				layer2: layerScores.layer2,
				layer3: layerScores.layer3,
				feature_scores: layerScores.featureScores,
				dealbreakers: dealbreakers.triggered ? dealbreakers.features : [],
			} as Json,
		};
	} catch (e) {
		console.warn("[runFoxConversation] 3-layer scoring failed (interaction_dna_scores table may not exist), falling back to simple scoring:", e);
		// Fallback: use simple profile + conversation weighted score
		const { data: matchRow } = await supabase.from("matches").select("profile_score, score_details").eq("id", conv.match_id).single();
		const profileScore = (matchRow?.profile_score as number) ?? 50;
		const existingDetails = (matchRow?.score_details as Record<string, unknown>) ?? {};
		finalScore = profileScore * 0.4 + conversationScore * 0.6;
		layerData = {
			score_details: {
				...existingDetails,
				conversation_analysis: analysis,
			} as Json,
		};
	}

	await supabase
		.from("matches")
		.update({
			conversation_score: conversationScore,
			final_score: finalScore,
			...layerData,
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
