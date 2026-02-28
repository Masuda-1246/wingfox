import { Hono } from "hono";
import type { Env } from "../env";
import type { Database, Json } from "../db/types";
import { getSupabaseClient } from "../db/client";
import { requireAuth } from "../middleware/auth";
import { jsonData, jsonError } from "../lib/response";
import { chatComplete, MISTRAL_LARGE } from "../services/mistral";
import { buildProfileGenerationPrompt } from "../prompts/profile-generation";
import { executeMatching } from "../services/matching";
import { scoreInteractionDna } from "../services/interaction-dna";
import { z } from "zod";

const profiles = new Hono<Env>();
const MIN_COMPLETED_SESSIONS = 3;
const MIN_CONVERSATION_MESSAGES = 12;

function detectLangFromHeader(c: { req: { header: (name: string) => string | undefined } }): "ja" | "en" {
	const accept = c.req.header("accept-language") ?? "";
	return accept.startsWith("en") ? "en" : "ja";
}

/** POST /api/profiles/generate */
profiles.post("/generate", requireAuth, async (c) => {
	const userId = c.get("user_id");
	const lang = detectLangFromHeader(c);
	const apiKey = c.env.MISTRAL_API_KEY;
	if (!apiKey?.trim()) {
		return jsonError(c, "INTERNAL_ERROR", "Mistral API not configured");
	}
	const supabase = getSupabaseClient(c.env);
	const { data: answers } = await supabase
		.from("quiz_answers")
		.select("question_id, selected")
		.eq("user_id", userId);
	const { data: sessions } = await supabase
		.from("speed_dating_sessions")
		.select("id, completed_at")
		.eq("user_id", userId)
		.eq("status", "completed")
		.order("completed_at", { ascending: false, nullsFirst: false })
		.limit(3);
	if ((sessions ?? []).length < MIN_COMPLETED_SESSIONS) {
		return jsonError(c, "CONFLICT", "Not enough completed speed-dating sessions");
	}
	const sessionIds = (sessions ?? []).map((s) => s.id);
	let conversationLogs = "";
	let totalMessages = 0;
	for (const sid of sessionIds) {
		const { data: msgs } = await supabase
			.from("speed_dating_messages")
			.select("role, content")
			.eq("session_id", sid)
			.order("created_at", { ascending: true });
		conversationLogs += `--- Session ${sid} ---\n`;
		for (const m of msgs ?? []) {
			conversationLogs += `${m.role}: ${m.content}\n`;
			totalMessages += 1;
		}
	}
	if (totalMessages < MIN_CONVERSATION_MESSAGES) {
		return jsonError(c, "CONFLICT", "Not enough conversation data to generate profile");
	}
	const quizText = JSON.stringify(answers ?? [], null, 2);
	const prompt = buildProfileGenerationPrompt(quizText, conversationLogs, lang);
	const raw = await chatComplete(apiKey, [{ role: "user", content: prompt }], {
		model: MISTRAL_LARGE,
		maxTokens: 1500,
		responseFormat: { type: "json_object" },
	});
	let profileData: Record<string, unknown> = {};
	try {
		profileData = JSON.parse(raw.trim()) as Record<string, unknown>;
	} catch (_) {
		return jsonError(c, "INTERNAL_ERROR", "Failed to parse generated profile JSON");
	}
	if (Object.keys(profileData).length === 0) {
		return jsonError(c, "INTERNAL_ERROR", "Generated profile is empty");
	}
	const { data: existing } = await supabase.from("profiles").select("id, version").eq("user_id", userId).single();
	const version = (existing?.version ?? 0) + 1;
	const { data: profile, error } = await supabase
		.from("profiles")
		.upsert(
			{
				user_id: userId,
				basic_info: profileData.basic_info ?? {},
				personality_tags: profileData.personality_tags ?? [],
				personality_analysis: profileData.personality_analysis ?? {},
				interaction_style: (profileData.interaction_style ?? {}) as Json,
				interests: profileData.interests ?? [],
				values: profileData.values ?? {},
				romance_style: profileData.romance_style ?? {},
				communication_style: profileData.communication_style ?? {},
				lifestyle: profileData.lifestyle ?? {},
				status: "draft",
				version,
				updated_at: new Date().toISOString(),
			} as Database["public"]["Tables"]["profiles"]["Insert"],
			{ onConflict: "user_id" },
		)
		.select()
		.single();
	if (error) {
		console.error("[profiles/generate] upsert error:", error.message, error.code, error.details);
		return jsonError(c, "INTERNAL_ERROR", `Failed to save profile: ${error.message}`);
	}

	// DNA scoring: analyze all 3 speed dating transcripts for 13 psychological features.
	// Non-fatal — if it fails, the basic profile is still saved above.
	try {
		const dnaResult = await scoreInteractionDna(supabase, userId, apiKey, lang);
		if (dnaResult) {
			await supabase
				.from("profiles")
				.update({
					interaction_style: dnaResult.interactionStyle as Json,
					updated_at: new Date().toISOString(),
				})
				.eq("user_id", userId);
		}
	} catch (e) {
		console.error("[profiles/generate] DNA scoring failed (non-fatal):", e);
	}

	await supabase
		.from("user_profiles")
		.update({ onboarding_status: "profile_generated", updated_at: new Date().toISOString() })
		.eq("id", userId);

	// Re-fetch profile to include DNA scoring results
	const { data: updatedProfile } = await supabase
		.from("profiles")
		.select("*")
		.eq("user_id", userId)
		.single();
	return jsonData(c, updatedProfile ?? profile);
});

/** GET /api/profiles/me */
profiles.get("/me", requireAuth, async (c) => {
	const userId = c.get("user_id");
	const supabase = getSupabaseClient(c.env);
	const { data, error } = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();
	if (error) return jsonError(c, "INTERNAL_ERROR", "Failed to fetch profile");
	if (!data) {
		const { data: inserted, error: insertError } = await supabase
			.from("profiles")
			.insert({
				user_id: userId,
				basic_info: {},
				personality_tags: [],
				personality_analysis: {},
				interests: [],
				values: {},
				romance_style: {},
				communication_style: {},
				lifestyle: {},
				status: "draft",
				version: 1,
			})
			.select()
			.single();
		if (insertError) return jsonError(c, "INTERNAL_ERROR", "Failed to create profile");
		return jsonData(c, inserted);
	}
	return jsonData(c, data);
});

const putProfileSchema = z.object({
	personality_tags: z.array(z.string()).optional(),
	interests: z.array(z.object({ category: z.string(), items: z.array(z.string()) })).optional(),
	basic_info: z.record(z.unknown()).optional(),
	values: z.record(z.unknown()).optional(),
	romance_style: z.record(z.unknown()).optional(),
	lifestyle: z.record(z.unknown()).optional(),
	communication_style: z.record(z.unknown()).optional(),
});

/** PUT /api/profiles/me */
profiles.put("/me", requireAuth, async (c) => {
	const userId = c.get("user_id");
	const parsed = putProfileSchema.safeParse(await c.req.json());
	if (!parsed.success) return jsonError(c, "BAD_REQUEST", parsed.error.message);
	const supabase = getSupabaseClient(c.env);
	const { data: existing } = await supabase.from("profiles").select("id, status").eq("user_id", userId).single();
	if (!existing) return jsonError(c, "NOT_FOUND", "Profile not found");
	if (existing.status === "confirmed") return jsonError(c, "CONFLICT", "Profile already confirmed");
	const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
	for (const [k, v] of Object.entries(parsed.data)) {
		if (v !== undefined) updates[k] = v;
	}
	const { data, error } = await supabase.from("profiles").update(updates).eq("user_id", userId).select().single();
	if (error) return jsonError(c, "INTERNAL_ERROR", "Failed to update");
	return jsonData(c, data);
});

/** POST /api/profiles/me/confirm */
profiles.post("/me/confirm", requireAuth, async (c) => {
	const userId = c.get("user_id");
	const supabase = getSupabaseClient(c.env);
	const { data: wingfox } = await supabase
		.from("personas")
		.select("id")
		.eq("user_id", userId)
		.eq("persona_type", "wingfox")
		.single();
	if (!wingfox) return jsonError(c, "CONFLICT", "Wingfox persona not generated");
	const { error } = await supabase
		.from("profiles")
		.update({
			status: "confirmed",
			confirmed_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		})
		.eq("user_id", userId);
	if (error) return jsonError(c, "INTERNAL_ERROR", "Failed to confirm");
	const { error: onboardingError } = await supabase
		.from("user_profiles")
		.update({ onboarding_status: "confirmed", updated_at: new Date().toISOString() })
		.eq("id", userId);
	if (onboardingError) return jsonError(c, "INTERNAL_ERROR", "Failed to update onboarding status");

	// Run matching in the background without blocking the response.
	// Use waitUntil on Workers so the runtime keeps the task alive after response.
	const matchingTask = executeMatching(supabase, 10)
		.then((count) => {
			console.log(`[matching] created ${count} matches after profile confirm`);
		})
		.catch((err) => {
			console.error("[matching] executeMatching failed after profile confirm:", err);
		});
	try {
		c.executionCtx.waitUntil(matchingTask);
	} catch {
		// Node.js dev server — promise runs detached
	}
	return jsonData(c, { status: "confirmed", confirmed_at: new Date().toISOString() });
});

/** POST /api/profiles/me/reset */
profiles.post("/me/reset", requireAuth, async (c) => {
	const userId = c.get("user_id");
	const supabase = getSupabaseClient(c.env);
	await supabase.from("user_profiles").update({ onboarding_status: "not_started", updated_at: new Date().toISOString() }).eq("id", userId);
	await supabase.from("profiles").update({ status: "draft", updated_at: new Date().toISOString() }).eq("user_id", userId);
	return jsonData(c, { message: "Onboarding reset", onboarding_status: "not_started" });
});

export default profiles;
