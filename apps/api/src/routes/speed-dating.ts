import { Hono } from "hono";
import type { Env } from "../env";
import { getSupabaseClient } from "../db/client";
import { requireAuth } from "../middleware/auth";
import { jsonData, jsonError } from "../lib/response";
import { chatComplete } from "../services/mistral";
import { buildVirtualPersonaPrompt } from "../prompts/virtual-persona";
import { buildSpeedDatingSystemPrompt } from "../prompts/speed-dating";
import { z } from "zod";

const speedDating = new Hono<Env>();

const SECTION_ORDER = [
	"core_identity",
	"communication_rules",
	"personality_profile",
	"interests",
	"values",
	"constraints",
] as const;

function parsePersonaMarkdown(text: string): { name: string; sections: Record<string, string> } {
	const sections: Record<string, string> = {};
	let name = "ペルソナ";
	const lines = text.split("\n");
	let currentSection = "";
	let currentContent: string[] = [];

	for (const line of lines) {
		if (line.startsWith("name:")) {
			name = line.replace(/^name:\s*/, "").trim();
			continue;
		}
		const match = line.match(/^##\s+(.+)$/);
		if (match) {
			if (currentSection) {
				sections[currentSection] = currentContent.join("\n").trim();
			}
			currentSection = match[1].trim().toLowerCase().replace(/\s+/g, "_");
			if (currentSection === "コアアイデンティティ") currentSection = "core_identity";
			else if (currentSection === "コミュニケーションルール") currentSection = "communication_rules";
			else if (currentSection === "パーソナリティプロファイル") currentSection = "personality_profile";
			else if (currentSection === "興味・関心マップ") currentSection = "interests";
			else if (currentSection === "価値観") currentSection = "values";
			else if (currentSection === "制約事項") currentSection = "constraints";
			currentContent = [];
		} else {
			currentContent.push(line);
		}
	}
	if (currentSection) {
		sections[currentSection] = currentContent.join("\n").trim();
	}
	return { name, sections };
}

/** POST /api/speed-dating/personas - generate 3 virtual personas */
speedDating.post("/personas", requireAuth, async (c) => {
	const userId = c.get("user_id");
	const apiKey = c.env.MISTRAL_API_KEY;
	if (!apiKey) {
		return jsonError(c, "INTERNAL_ERROR", "Mistral API not configured");
	}
	const supabase = getSupabaseClient(c.env);
	const { data: answers } = await supabase
		.from("quiz_answers")
		.select("question_id, selected")
		.eq("user_id", userId);
	const quizSummary = JSON.stringify(answers ?? [], null, 2);

	const types = ["virtual_similar", "virtual_complementary", "virtual_discovery"] as const;
	const results: { id: string; persona_type: string; name: string; compiled_document: string; sections: { section_id: string; title: string; content: string }[] }[] = [];

	for (const personaType of types) {
		const prompt = buildVirtualPersonaPrompt(quizSummary, personaType);
		const raw = await chatComplete(apiKey, [{ role: "user", content: prompt }], { maxTokens: 1500 });
		const { name, sections } = parsePersonaMarkdown(raw);
		const compiledDocument = raw;
		const { data: persona, error: insertErr } = await supabase
			.from("personas")
			.upsert(
				{
					user_id: userId,
					persona_type: personaType,
					name: name || personaType,
					compiled_document: compiledDocument,
				},
				{ onConflict: "user_id,persona_type" },
			)
			.select("id")
			.single();
		if (insertErr || !persona) {
			console.error("persona insert error:", insertErr);
			continue;
		}
		for (const sectionId of SECTION_ORDER) {
			const content = sections[sectionId] ?? "";
			if (!content) continue;
			await supabase.from("persona_sections").upsert(
				{
					persona_id: persona.id,
					section_id: sectionId,
					content,
				},
				{ onConflict: "persona_id,section_id" },
			);
		}
		const sectionList = SECTION_ORDER.filter((id) => sections[id]).map((id) => ({
			section_id: id,
			title: id,
			content: sections[id],
		}));
		results.push({
			id: persona.id,
			persona_type: personaType,
			name: name || personaType,
			compiled_document: compiledDocument,
			sections: sectionList,
		});
	}

	return jsonData(c, results);
});

/** GET /api/speed-dating/personas */
speedDating.get("/personas", requireAuth, async (c) => {
	const userId = c.get("user_id");
	const supabase = getSupabaseClient(c.env);
	const { data, error } = await supabase
		.from("personas")
		.select("id, persona_type, name, compiled_document")
		.eq("user_id", userId)
		.in("persona_type", ["virtual_similar", "virtual_complementary", "virtual_discovery"]);
	if (error) return jsonError(c, "INTERNAL_ERROR", "Failed to fetch personas");
	const withSections = await Promise.all(
		(data ?? []).map(async (p) => {
			const { data: secs } = await supabase
				.from("persona_sections")
				.select("section_id, content")
				.eq("persona_id", p.id);
			return {
				...p,
				sections: (secs ?? []).map((s) => ({ section_id: s.section_id, title: s.section_id, content: s.content })),
			};
		}),
	);
	return jsonData(c, withSections);
});

const postSessionSchema = z.object({ persona_id: z.string().uuid() });
const postMessageSchema = z.object({ content: z.string().min(1).max(2000) });

/** POST /api/speed-dating/sessions */
speedDating.post("/sessions", requireAuth, async (c) => {
	const userId = c.get("user_id");
	const parsed = postSessionSchema.safeParse(await c.req.json());
	if (!parsed.success) return jsonError(c, "BAD_REQUEST", parsed.error.message);
	const supabase = getSupabaseClient(c.env);
	const { data: persona } = await supabase
		.from("personas")
		.select("id, compiled_document, name")
		.eq("id", parsed.data.persona_id)
		.eq("user_id", userId)
		.in("persona_type", ["virtual_similar", "virtual_complementary", "virtual_discovery"])
		.single();
	if (!persona) return jsonError(c, "NOT_FOUND", "Persona not found");
	const { data: session, error: sessionErr } = await supabase
		.from("speed_dating_sessions")
		.insert({ user_id: userId, persona_id: persona.id })
		.select("id")
		.single();
	if (sessionErr || !session) return jsonError(c, "INTERNAL_ERROR", "Failed to create session");
	const apiKey = c.env.MISTRAL_API_KEY;
	let firstContent = "はじめまして！よろしくお願いします。";
	if (apiKey) {
		const systemPrompt = buildSpeedDatingSystemPrompt(persona.compiled_document);
		firstContent = await chatComplete(apiKey, [
			{ role: "system", content: systemPrompt },
			{ role: "user", content: "自己紹介と、相手に一言聞いてください。" },
		]);
	}
	const { data: firstMsg } = await supabase
		.from("speed_dating_messages")
		.insert({
			session_id: session.id,
			role: "persona",
			content: firstContent,
		})
		.select("id, role, content, created_at")
		.single();
	await supabase
		.from("speed_dating_sessions")
		.update({ message_count: 1 })
		.eq("id", session.id);
	return jsonData(c, {
		session_id: session.id,
		persona: { id: persona.id, name: persona.name, personality_summary: persona.compiled_document.slice(0, 200) },
		first_message: firstMsg ?? { id: "", role: "persona", content: firstContent, created_at: new Date().toISOString() },
	});
});

/** GET /api/speed-dating/sessions/:id */
speedDating.get("/sessions/:id", requireAuth, async (c) => {
	const userId = c.get("user_id");
	const id = c.req.param("id");
	const supabase = getSupabaseClient(c.env);
	const { data: session, error } = await supabase
		.from("speed_dating_sessions")
		.select("*, personas(name)")
		.eq("id", id)
		.eq("user_id", userId)
		.single();
	if (error || !session) return jsonError(c, "NOT_FOUND", "Session not found");
	const { data: messages } = await supabase
		.from("speed_dating_messages")
		.select("id, role, content, created_at")
		.eq("session_id", id)
		.order("created_at", { ascending: true });
	return jsonData(c, { ...session, messages: messages ?? [] });
});

/** POST /api/speed-dating/sessions/:id/messages */
speedDating.post("/sessions/:id/messages", requireAuth, async (c) => {
	const userId = c.get("user_id");
	const id = c.req.param("id");
	const parsed = postMessageSchema.safeParse(await c.req.json());
	if (!parsed.success) return jsonError(c, "BAD_REQUEST", parsed.error.message);
	const supabase = getSupabaseClient(c.env);
	const { data: session } = await supabase
		.from("speed_dating_sessions")
		.select("id, persona_id")
		.eq("id", id)
		.eq("user_id", userId)
		.single();
	if (!session) return jsonError(c, "NOT_FOUND", "Session not found");
	const { data: persona } = await supabase
		.from("personas")
		.select("compiled_document")
		.eq("id", session.persona_id)
		.single();
	await supabase.from("speed_dating_messages").insert({
		session_id: id,
		role: "user",
		content: parsed.data.content,
	});
	const { data: history } = await supabase
		.from("speed_dating_messages")
		.select("role, content")
		.eq("session_id", id)
		.order("created_at", { ascending: true });
	const messagesForAi = (history ?? []).map((m) => ({
		role: m.role === "user" ? "user" as const : "assistant" as const,
		content: m.content,
	}));
	let personaContent = "（応答を生成できませんでした）";
	const apiKey = c.env.MISTRAL_API_KEY;
	if (apiKey && persona) {
		const systemPrompt = buildSpeedDatingSystemPrompt(persona.compiled_document);
		personaContent = await chatComplete(apiKey, [
			{ role: "system", content: systemPrompt },
			...messagesForAi,
		], { maxTokens: 512 });
	}
	const { data: personaMsg } = await supabase
		.from("speed_dating_messages")
		.insert({ session_id: id, role: "persona", content: personaContent })
		.select("id, role, content, created_at")
		.single();
	const { data: countRow } = await supabase
		.from("speed_dating_sessions")
		.select("message_count")
		.eq("id", id)
		.single();
	const count = (countRow?.message_count ?? 0) + 2;
	await supabase.from("speed_dating_sessions").update({ message_count: count }).eq("id", id);
	return jsonData(c, {
		user_message: { id: "", role: "user", content: parsed.data.content, created_at: new Date().toISOString() },
		persona_message: personaMsg ?? { id: "", role: "persona", content: personaContent, created_at: new Date().toISOString() },
		message_count: count,
	});
});

/** POST /api/speed-dating/sessions/:id/complete */
speedDating.post("/sessions/:id/complete", requireAuth, async (c) => {
	const userId = c.get("user_id");
	const id = c.req.param("id");
	const supabase = getSupabaseClient(c.env);
	const { data: session, error } = await supabase
		.from("speed_dating_sessions")
		.update({ status: "completed", completed_at: new Date().toISOString() })
		.eq("id", id)
		.eq("user_id", userId)
		.select("id")
		.single();
	if (error || !session) return jsonError(c, "NOT_FOUND", "Session not found");
	const { count } = await supabase
		.from("speed_dating_sessions")
		.select("id", { count: "exact", head: true })
		.eq("user_id", userId)
		.eq("status", "completed");
	const allDone = (count ?? 0) >= 3;
	if (allDone) {
		await supabase
			.from("user_profiles")
			.update({ onboarding_status: "speed_dating_completed", updated_at: new Date().toISOString() })
			.eq("id", userId);
	}
	return jsonData(c, { session_id: id, status: "completed", all_sessions_completed: allDone });
});

export default speedDating;
