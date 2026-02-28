import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../db/types";
import { z } from "zod";
import { chatComplete, MISTRAL_LARGE } from "./mistral";
import { buildInteractionDnaScoringPrompt } from "../prompts/interaction-dna-scoring";

const DnaFeatureSchema = z.object({
	score: z.number().min(0).max(1),
	confidence: z.number().min(0).max(1),
	evidence_turns: z.array(z.number()),
	reasoning: z.string(),
});

const InteractionDnaResultSchema = z.object({
	features: z.object({
		mere_exposure: DnaFeatureSchema,
		reciprocity: DnaFeatureSchema,
		similarity_complementarity: DnaFeatureSchema,
		attachment: DnaFeatureSchema,
		humor_sharing: DnaFeatureSchema,
		self_disclosure: DnaFeatureSchema,
		synchrony: DnaFeatureSchema,
		emotional_responsiveness: DnaFeatureSchema,
		self_expansion: DnaFeatureSchema,
		self_esteem_reception: DnaFeatureSchema,
		physiological: DnaFeatureSchema,
		economic_alignment: DnaFeatureSchema,
		conflict_resolution: DnaFeatureSchema,
	}),
	overall_interaction_signature: z.string(),
	preferred_persona_type: z.enum([
		"virtual_similar",
		"virtual_complementary",
		"virtual_discovery",
	]),
});

type DnaFeatures = z.infer<typeof InteractionDnaResultSchema>["features"];

function deriveConflictStyle(score: number): string {
	if (score >= 0.7) return "dialogue";
	if (score >= 0.4) return "maintains";
	if (score >= 0.2) return "yields";
	return "avoids";
}

function deriveAttachmentTendency(score: number): string {
	if (score >= 0.65) return "secure";
	if (score >= 0.35) return "anxious";
	return "avoidant";
}

function deriveRhythmPreference(score: number): string {
	if (score >= 0.65) return "fast";
	if (score >= 0.35) return "moderate";
	return "slow";
}

function buildInteractionStyle(features: DnaFeatures) {
	const dnaScores: Record<string, { score: number; confidence: number; evidence_turns: number[]; reasoning: string }> = {};
	for (const [key, value] of Object.entries(features)) {
		dnaScores[key] = {
			score: value.score,
			confidence: value.confidence,
			evidence_turns: value.evidence_turns,
			reasoning: value.reasoning,
		};
	}

	return {
		// Backward-compatible old fields
		warmup_speed: features.mere_exposure.score,
		humor_responsiveness: features.humor_sharing.score,
		self_disclosure_depth: features.self_disclosure.score,
		emotional_responsiveness: features.emotional_responsiveness.score,
		conflict_style: deriveConflictStyle(features.conflict_resolution.score),
		attachment_tendency: deriveAttachmentTendency(features.attachment.score),
		rhythm_preference: deriveRhythmPreference(features.physiological.score),
		mirroring_tendency: features.synchrony.score,
		// New DNA fields
		dna_scores: dnaScores,
	};
}

/**
 * Scores a user's interaction DNA from their 3 speed dating sessions.
 * Non-fatal: returns null on failure so the caller can still save the basic profile.
 */
export async function scoreInteractionDna(
	supabase: SupabaseClient<Database>,
	userId: string,
	apiKey: string,
	lang: "ja" | "en",
): Promise<{
	interactionStyle: Record<string, unknown>;
	overallSignature: string;
	preferredPersonaType: string;
} | null> {
	try {
		// Fetch completed sessions with persona type info
		const { data: sessions } = await supabase
			.from("speed_dating_sessions")
			.select("id, persona_id, completed_at")
			.eq("user_id", userId)
			.eq("status", "completed")
			.order("completed_at", { ascending: false, nullsFirst: false })
			.limit(3);

		if (!sessions || sessions.length < 3) {
			console.warn("[scoreInteractionDna] Not enough completed sessions:", sessions?.length ?? 0);
			return null;
		}

		// Fetch persona types for each session
		const personaIds = sessions.map((s) => s.persona_id).filter(Boolean) as string[];
		const { data: personas } = await supabase
			.from("personas")
			.select("id, persona_type")
			.in("id", personaIds);

		const personaTypeMap = new Map<string, string>();
		for (const p of personas ?? []) {
			personaTypeMap.set(p.id, p.persona_type);
		}

		// Fetch transcripts for each session
		const sessionTranscripts: { personaType: string; transcript: string }[] = [];
		for (const session of sessions.slice(0, 3)) {
			const { data: msgs } = await supabase
				.from("speed_dating_messages")
				.select("role, content")
				.eq("session_id", session.id)
				.order("created_at", { ascending: true });

			const transcript = (msgs ?? [])
				.map((m) => `${m.role}: ${m.content}`)
				.join("\n");

			sessionTranscripts.push({
				personaType: personaTypeMap.get(session.persona_id ?? "") ?? "unknown",
				transcript,
			});
		}

		// Call Mistral Large for DNA scoring
		const prompt = buildInteractionDnaScoringPrompt(sessionTranscripts, lang);
		const raw = await chatComplete(apiKey, [{ role: "user", content: prompt }], {
			model: MISTRAL_LARGE,
			maxTokens: 2500,
			responseFormat: { type: "json_object" },
		});

		const parsed = InteractionDnaResultSchema.parse(JSON.parse(raw.trim()));
		const interactionStyle = buildInteractionStyle(parsed.features);

		return {
			interactionStyle: {
				...interactionStyle,
				overall_signature: parsed.overall_interaction_signature,
				preferred_persona_type: parsed.preferred_persona_type,
			},
			overallSignature: parsed.overall_interaction_signature,
			preferredPersonaType: parsed.preferred_persona_type,
		};
	} catch (e) {
		console.error("[scoreInteractionDna] DNA scoring failed (non-fatal):", e);
		return null;
	}
}
