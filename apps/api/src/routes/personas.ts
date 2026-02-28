import { Hono } from "hono";
import type { Env } from "../env";
import { getSupabaseClient } from "../db/client";
import { requireAuth } from "../middleware/auth";
import { jsonData, jsonError } from "../lib/response";
import { chatComplete } from "../services/mistral";
import { buildWingfoxSectionPrompt, CONSTRAINTS_CONTENT } from "../prompts/wingfox-generation";
import { z } from "zod";

const personas = new Hono<Env>();

const WINGFOX_EDITABLE_SECTIONS = [
	"core_identity",
	"communication_rules",
	"personality_profile",
	"interests",
	"values",
	"romance_style",
];

/** POST /api/personas/wingfox/generate */
personas.post("/wingfox/generate", requireAuth, async (c) => {
	const userId = c.get("user_id");
	const apiKey = c.env.MISTRAL_API_KEY;
	const supabase = getSupabaseClient(c.env);
	const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", userId).single();
	if (!profile) return jsonError(c, "CONFLICT", "Profile not generated");
	const { data: sessions } = await supabase
		.from("speed_dating_sessions")
		.select("id")
		.eq("user_id", userId);
	const sessionIds = (sessions ?? []).map((s) => s.id);
	let conversationExcerpts = "";
	for (const sid of sessionIds.slice(0, 3)) {
		const { data: msgs } = await supabase
			.from("speed_dating_messages")
			.select("role, content")
			.eq("session_id", sid)
			.order("created_at", { ascending: true })
			.limit(10);
		for (const m of msgs ?? []) {
			conversationExcerpts += `${m.role}: ${m.content.slice(0, 200)}\n`;
		}
	}
	const profileJson = JSON.stringify(profile, null, 2);
	const sections: { section_id: string; content: string }[] = [];
	for (const sectionId of WINGFOX_EDITABLE_SECTIONS) {
		const title = sectionId;
		const prompt = buildWingfoxSectionPrompt(sectionId, title, profileJson, conversationExcerpts || "（なし）");
		let content = "";
		if (apiKey) {
			content = await chatComplete(apiKey, [{ role: "user", content: prompt }], { maxTokens: 500 });
		}
		sections.push({ section_id: sectionId, content: content || `（${sectionId}）` });
	}
	sections.push({ section_id: "conversation_references", content: "会話サンプルから自動抽出（編集不可）" });
	sections.push({ section_id: "constraints", content: CONSTRAINTS_CONTENT });
	const compiledDocument = sections.map((s) => `## ${s.section_id}\n\n${s.content}`).join("\n\n");
	const { data: persona, error } = await supabase
		.from("personas")
		.upsert(
			{
				user_id: userId,
				persona_type: "wingfox",
				name: "ウィングフォックス",
				compiled_document: compiledDocument,
				updated_at: new Date().toISOString(),
			},
			{ onConflict: "user_id,persona_type" },
		)
		.select("id, persona_type, name, compiled_document, version")
		.single();
	if (error) return jsonError(c, "INTERNAL_ERROR", "Failed to save persona");
	for (const s of sections) {
		await supabase.from("persona_sections").upsert(
			{
				persona_id: persona.id,
				section_id: s.section_id,
				content: s.content,
			},
			{ onConflict: "persona_id,section_id" },
		);
	}
	await supabase
		.from("user_profiles")
		.update({ onboarding_status: "persona_generated", updated_at: new Date().toISOString() })
		.eq("id", userId);
	const { data: secList } = await supabase
		.from("persona_sections")
		.select("section_id, content, source")
		.eq("persona_id", persona.id);
	const sectionDefs = await supabase.from("persona_section_definitions").select("id, title, editable");
	const editableMap = new Map((sectionDefs.data ?? []).map((d) => [d.id, d.editable]));
	return jsonData(c, {
		...persona,
		sections: (secList ?? []).map((s) => ({
			section_id: s.section_id,
			title: s.section_id,
			content: s.content,
			source: s.source,
			editable: editableMap.get(s.section_id) ?? true,
		})),
	});
});

/** GET /api/personas */
personas.get("/", requireAuth, async (c) => {
	const userId = c.get("user_id");
	const typeFilter = c.req.query("persona_type");
	const supabase = getSupabaseClient(c.env);
	let q = supabase.from("personas").select("id, persona_type, name, version, created_at, updated_at").eq("user_id", userId);
	if (typeFilter) q = q.eq("persona_type", typeFilter);
	const { data, error } = await q;
	if (error) return jsonError(c, "INTERNAL_ERROR", "Failed to fetch personas");
	return jsonData(c, data ?? []);
});

/** GET /api/personas/section-definitions */
personas.get("/section-definitions", requireAuth, async (c) => {
	const supabase = getSupabaseClient(c.env);
	const typeFilter = c.req.query("persona_type");
	const { data, error } = await supabase
		.from("persona_section_definitions")
		.select("id, title, description, sort_order, editable, applicable_persona_types")
		.order("sort_order");
	if (error) return jsonError(c, "INTERNAL_ERROR", "Failed to fetch definitions");
	let list = data ?? [];
	if (typeFilter) {
		list = list.filter((row) => (row.applicable_persona_types ?? []).includes(typeFilter));
	}
	return jsonData(c, list);
});

/** GET /api/personas/:personaId */
personas.get("/:personaId", requireAuth, async (c) => {
	const userId = c.get("user_id");
	const personaId = c.req.param("personaId");
	const supabase = getSupabaseClient(c.env);
	const { data, error } = await supabase
		.from("personas")
		.select("*")
		.eq("id", personaId)
		.eq("user_id", userId)
		.single();
	if (error || !data) return jsonError(c, "NOT_FOUND", "Persona not found");
	return jsonData(c, data);
});

/** GET /api/personas/:personaId/sections */
personas.get("/:personaId/sections", requireAuth, async (c) => {
	const userId = c.get("user_id");
	const personaId = c.req.param("personaId");
	const supabase = getSupabaseClient(c.env);
	const { data: p } = await supabase.from("personas").select("id").eq("id", personaId).eq("user_id", userId).single();
	if (!p) return jsonError(c, "NOT_FOUND", "Persona not found");
	const { data: sections } = await supabase
		.from("persona_sections")
		.select("id, section_id, content, source, updated_at")
		.eq("persona_id", personaId);
	const { data: defs } = await supabase.from("persona_section_definitions").select("id, title, editable");
	const defMap = new Map((defs ?? []).map((d) => [d.id, d]));
	const list = (sections ?? []).map((s) => ({
		...s,
		title: defMap.get(s.section_id)?.title ?? s.section_id,
		editable: defMap.get(s.section_id)?.editable ?? true,
	}));
	return jsonData(c, list);
});

/** GET /api/personas/:personaId/sections/:sectionId */
personas.get("/:personaId/sections/:sectionId", requireAuth, async (c) => {
	const userId = c.get("user_id");
	const personaId = c.req.param("personaId");
	const sectionId = c.req.param("sectionId");
	const supabase = getSupabaseClient(c.env);
	const { data: p } = await supabase.from("personas").select("id").eq("id", personaId).eq("user_id", userId).single();
	if (!p) return jsonError(c, "NOT_FOUND", "Persona not found");
	const { data: section } = await supabase
		.from("persona_sections")
		.select("*")
		.eq("persona_id", personaId)
		.eq("section_id", sectionId)
		.single();
	if (!section) return jsonError(c, "NOT_FOUND", "Section not found");
	const { data: def } = await supabase.from("persona_section_definitions").select("id, title, description, editable").eq("id", sectionId).single();
	return jsonData(c, {
		...section,
		title: def?.title ?? sectionId,
		description: def?.description ?? "",
		editable: def?.editable ?? true,
	});
});

const putSectionSchema = z.object({ content: z.string() });

/** PUT /api/personas/:personaId/sections/:sectionId */
personas.put("/:personaId/sections/:sectionId", requireAuth, async (c) => {
	const userId = c.get("user_id");
	const personaId = c.req.param("personaId");
	const sectionId = c.req.param("sectionId");
	const parsed = putSectionSchema.safeParse(await c.req.json());
	if (!parsed.success) return jsonError(c, "BAD_REQUEST", parsed.error.message);
	const supabase = getSupabaseClient(c.env);
	const { data: persona } = await supabase.from("personas").select("id").eq("id", personaId).eq("user_id", userId).single();
	if (!persona) return jsonError(c, "NOT_FOUND", "Persona not found");
	const { data: def } = await supabase.from("persona_section_definitions").select("editable").eq("id", sectionId).single();
	if (def && !def.editable) return jsonError(c, "FORBIDDEN", "Section not editable");
	await supabase
		.from("persona_sections")
		.update({ content: parsed.data.content, source: "manual", updated_at: new Date().toISOString() })
		.eq("persona_id", personaId)
		.eq("section_id", sectionId);
	const { data: sections } = await supabase.from("persona_sections").select("section_id, content").eq("persona_id", personaId).order("section_id");
	const compiledDocument = (sections ?? []).map((s) => `## ${s.section_id}\n\n${s.content}`).join("\n\n");
	await supabase.from("personas").update({ compiled_document: compiledDocument, updated_at: new Date().toISOString() }).eq("id", personaId);
	const { data: updated } = await supabase
		.from("persona_sections")
		.select("id, section_id, content, source, updated_at")
		.eq("persona_id", personaId)
		.eq("section_id", sectionId)
		.single();
	return jsonData(c, updated ?? { section_id: sectionId, content: parsed.data.content, source: "manual", updated_at: new Date().toISOString() });
});

export default personas;
