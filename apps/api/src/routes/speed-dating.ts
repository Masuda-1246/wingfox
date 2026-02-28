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

const FEMALE_VOICE_IDS = [
	"9BWtsMINqrJLrRacOk9x", // Aria
	"EXAVITQu4vr4xnSDxMaL", // Sarah
];
const MALE_VOICE_IDS = [
	"CwhRBWXzGAHq8TQ4Fs17", // Roger
	"JBFqnCBsd6RMkjVDRZzb", // George
];

function pickVoiceId(gender: "male" | "female", index: number): string {
	const voices = gender === "male" ? MALE_VOICE_IDS : FEMALE_VOICE_IDS;
	return voices[index % voices.length];
}

function stableIndexFromString(input: string): number {
	let hash = 0;
	for (let i = 0; i < input.length; i += 1) {
		hash = (hash * 31 + input.charCodeAt(i)) | 0;
	}
	return Math.abs(hash);
}

function detectGender(compiledDocument: string): "male" | "female" {
	const parsed = parsePersonaMarkdown(compiledDocument);
	if (parsed.gender) return parsed.gender;
	if (/男性|彼は|おじさん|お兄さん/.test(compiledDocument)) return "male";
	return "female";
}

const SECTION_ORDER = [
	"core_identity",
	"communication_rules",
	"personality_profile",
	"interests",
	"values",
	"constraints",
] as const;

function parsePersonaMarkdown(text: string): { name: string; gender: "male" | "female"; sections: Record<string, string> } {
	const sections: Record<string, string> = {};
	let name = "ペルソナ";
	let gender: "male" | "female" = "female";
	const lines = text.split("\n");
	let currentSection = "";
	let currentContent: string[] = [];

	for (const line of lines) {
		if (line.startsWith("name:")) {
			name = line.replace(/^name:\s*/, "").trim();
			continue;
		}
		if (line.startsWith("gender:")) {
			const val = line.replace(/^gender:\s*/, "").trim().toLowerCase();
			gender = val === "male" ? "male" : "female";
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
	return { name, gender, sections };
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

	// Generate all 3 personas in PARALLEL (3x faster)
	const rawResults = await Promise.all(
		types.map(async (personaType) => {
			const prompt = buildVirtualPersonaPrompt(quizSummary, personaType);
			const raw = await chatComplete(
				apiKey,
				[{ role: "user", content: prompt }],
				{ maxTokens: 1500, temperature: 1.0 },
			);
			return { personaType, raw };
		}),
	);

	// Deduplicate names
	const usedNames = new Set<string>();
	for (const r of rawResults) {
		const { name } = parsePersonaMarkdown(r.raw);
		if (usedNames.has(name)) {
			// Append type suffix to avoid duplicates
			const suffix = r.personaType === "virtual_similar" ? "α" : r.personaType === "virtual_complementary" ? "β" : "γ";
			r.raw = r.raw.replace(/^(name:\s*)(.+)$/m, `$1${name}${suffix}`);
		}
		usedNames.add(name);
	}

	// Save to DB in parallel
	const results = await Promise.all(
		rawResults.map(async ({ personaType, raw }) => {
			const { name, sections } = parsePersonaMarkdown(raw);
			const { data: persona, error: insertErr } = await supabase
				.from("personas")
				.upsert(
					{
						user_id: userId,
						persona_type: personaType,
						name: name || personaType,
						compiled_document: raw,
					},
					{ onConflict: "user_id,persona_type" },
				)
				.select("id")
				.single();
			if (insertErr || !persona) {
				console.error("persona insert error:", insertErr);
				return null;
			}
			await Promise.all(
				SECTION_ORDER.filter((id) => sections[id]).map((sectionId) =>
					supabase.from("persona_sections").upsert(
						{ persona_id: persona.id, section_id: sectionId, content: sections[sectionId] },
						{ onConflict: "persona_id,section_id" },
					),
				),
			);
			return {
				id: persona.id,
				persona_type: personaType,
				name: name || personaType,
				compiled_document: raw,
				sections: SECTION_ORDER.filter((id) => sections[id]).map((id) => ({
					section_id: id, title: id, content: sections[id],
				})),
			};
		}),
	);

	return jsonData(c, results.filter(Boolean));
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
	const startedAt = Date.now();
	const userId = c.get("user_id");
	const parsed = postSessionSchema.safeParse(await c.req.json());
	if (!parsed.success) return jsonError(c, "BAD_REQUEST", parsed.error.message);
	const supabase = getSupabaseClient(c.env);
	const personaLookupStartedAt = Date.now();
	const { data: persona } = await supabase
		.from("personas")
		.select("id, compiled_document, name")
		.eq("id", parsed.data.persona_id)
		.eq("user_id", userId)
		.in("persona_type", ["virtual_similar", "virtual_complementary", "virtual_discovery"])
		.single();
	const personaLookupMs = Date.now() - personaLookupStartedAt;
	if (!persona) return jsonError(c, "NOT_FOUND", "Persona not found");
	const insertStartedAt = Date.now();
	const { data: session, error: sessionErr } = await supabase
		.from("speed_dating_sessions")
		.insert({ user_id: userId, persona_id: persona.id })
		.select("id")
		.single();
	const insertMs = Date.now() - insertStartedAt;
	if (sessionErr || !session) return jsonError(c, "INTERNAL_ERROR", "Failed to create session");
	const totalMs = Date.now() - startedAt;
	if (totalMs > 1000) {
		console.warn(
			`[speed-dating/sessions] slow request ${totalMs}ms (persona_lookup=${personaLookupMs}ms, insert=${insertMs}ms)`,
		);
	}
	return jsonData(c, {
		session_id: session.id,
		persona: { id: persona.id, name: persona.name, personality_summary: persona.compiled_document.slice(0, 200) },
	});
});

/** GET /api/speed-dating/sessions/:id/signed-url */
speedDating.get("/sessions/:id/signed-url", requireAuth, async (c) => {
	const startedAt = Date.now();
	const userId = c.get("user_id");
	const id = c.req.param("id");
	const elevenLabsApiKey = c.env.ELEVENLABS_API_KEY;
	const agentId = c.env.ELEVENLABS_AGENT_ID;
	if (!elevenLabsApiKey || !agentId) {
		return jsonError(c, "INTERNAL_ERROR", "ElevenLabs not configured");
	}
	const supabase = getSupabaseClient(c.env);
	const sessionQueryStartedAt = Date.now();
	const { data: session } = await supabase
		.from("speed_dating_sessions")
		.select("id, status, personas(compiled_document, name)")
		.eq("id", id)
		.eq("user_id", userId)
		.single();
	const sessionQueryMs = Date.now() - sessionQueryStartedAt;
	if (!session) return jsonError(c, "NOT_FOUND", "Session not found");
	if (session.status === "completed") return jsonError(c, "BAD_REQUEST", "Session already completed");
	const persona = Array.isArray(session.personas) ? session.personas[0] : session.personas;
	if (!persona) return jsonError(c, "NOT_FOUND", "Persona not found");
	const systemPrompt = buildSpeedDatingSystemPrompt(persona.compiled_document);
	const firstMessage = `はじめまして！${persona.name}です。今日はよろしくお願いします。あなたのことを教えてください！`;
	const gender = detectGender(persona.compiled_document);
	const voiceId = pickVoiceId(gender, stableIndexFromString(session.id));
	const url = `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`;
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 8_000);
	const elStartedAt = Date.now();
	let elRes: Response;
	try {
		elRes = await fetch(url, {
			headers: { "xi-api-key": elevenLabsApiKey },
			signal: controller.signal,
		});
	} catch (err) {
		clearTimeout(timeout);
		const elapsed = Date.now() - elStartedAt;
		console.error("[ElevenLabs] signed-url fetch failed:", elapsed, "ms", err);
		return jsonError(c, "INTERNAL_ERROR", "ElevenLabs signed URL request timed out or failed");
	} finally {
		clearTimeout(timeout);
	}
	const elMs = Date.now() - elStartedAt;
	if (!elRes.ok) {
		const errText = await elRes.text();
		console.error("[ElevenLabs] signed-url error:", elRes.status, errText);
		return jsonError(c, "INTERNAL_ERROR", "Failed to get signed URL from ElevenLabs");
	}
	const { signed_url } = (await elRes.json()) as { signed_url: string };
	const totalMs = Date.now() - startedAt;
	if (totalMs > 1000) {
		console.warn(
			`[speed-dating/signed-url] slow request ${totalMs}ms (session_query=${sessionQueryMs}ms, elevenlabs=${elMs}ms)`,
		);
	}
	return jsonData(c, {
		signed_url,
		overrides: {
			agent: {
				prompt: { prompt: systemPrompt },
				firstMessage,
			},
			tts: {
				voiceId,
			},
		},
		persona: { name: persona.name },
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

const completeSessionSchema = z.object({
	transcript: z.array(z.object({
		source: z.enum(["user", "ai"]),
		message: z.string(),
	})).optional(),
});

/** POST /api/speed-dating/sessions/:id/complete */
speedDating.post("/sessions/:id/complete", requireAuth, async (c) => {
	const userId = c.get("user_id");
	const id = c.req.param("id");
	const body = await c.req.json().catch(() => ({}));
	const parsed = completeSessionSchema.safeParse(body);
	const transcript = parsed.success ? parsed.data.transcript : undefined;
	const supabase = getSupabaseClient(c.env);
	const { data: session, error } = await supabase
		.from("speed_dating_sessions")
		.update({ status: "completed", completed_at: new Date().toISOString() })
		.eq("id", id)
		.eq("user_id", userId)
		.select("id")
		.single();
	if (error || !session) return jsonError(c, "NOT_FOUND", "Session not found");
	if (transcript && transcript.length > 0) {
		const rows = transcript.map((entry) => ({
			session_id: id,
			role: entry.source === "ai" ? "persona" : "user",
			content: entry.message,
		}));
		await supabase.from("speed_dating_messages").insert(rows);
		await supabase
			.from("speed_dating_sessions")
			.update({ message_count: transcript.length })
			.eq("id", id);
	}
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
