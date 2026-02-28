import { Hono } from "hono";
import type { Env } from "../env";
import type { Database } from "../db/types";
import { getSupabaseClient } from "../db/client";
import { requireAuth } from "../middleware/auth";
import { jsonData, jsonError } from "../lib/response";
import { chatComplete } from "../services/mistral";
import { buildProfileGenerationPrompt } from "../prompts/profile-generation";
import { executeMatching } from "../services/matching";
import { z } from "zod";

const profiles = new Hono<Env>();

/** POST /api/profiles/generate */
profiles.post("/generate", requireAuth, async (c) => {
	const userId = c.get("user_id");
	const apiKey = c.env.MISTRAL_API_KEY;
	const supabase = getSupabaseClient(c.env);
	const { data: answers } = await supabase
		.from("quiz_answers")
		.select("question_id, selected")
		.eq("user_id", userId);
	const { data: sessions } = await supabase
		.from("speed_dating_sessions")
		.select("id")
		.eq("user_id", userId)
		.eq("status", "completed");
	const sessionIds = (sessions ?? []).map((s) => s.id);
	let conversationLogs = "";
	for (const sid of sessionIds) {
		const { data: msgs } = await supabase
			.from("speed_dating_messages")
			.select("role, content")
			.eq("session_id", sid)
			.order("created_at", { ascending: true });
		conversationLogs += `--- Session ${sid} ---\n`;
		for (const m of msgs ?? []) {
			conversationLogs += `${m.role}: ${m.content}\n`;
		}
	}
	const quizText = JSON.stringify(answers ?? [], null, 2);
	const prompt = buildProfileGenerationPrompt(quizText, conversationLogs || "（会話なし）");
	let profileData: Record<string, unknown> = {};
	if (apiKey) {
		const raw = await chatComplete(apiKey, [{ role: "user", content: prompt }], { maxTokens: 1500 });
		const jsonMatch = raw.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			try {
				profileData = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
			} catch (_) {
				profileData = {};
			}
		}
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
	if (error) return jsonError(c, "INTERNAL_ERROR", "Failed to save profile");
	await supabase
		.from("user_profiles")
		.update({ onboarding_status: "profile_generated", updated_at: new Date().toISOString() })
		.eq("id", userId);
	return jsonData(c, profile);
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
	await supabase
		.from("user_profiles")
		.update({ onboarding_status: "confirmed", updated_at: new Date().toISOString() })
		.eq("id", userId);
	await executeMatching(supabase, 10);
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
