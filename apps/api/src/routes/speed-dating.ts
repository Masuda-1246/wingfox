import { Hono } from "hono";
import type { Env } from "../env";
import { getSupabaseClient } from "../db/client";
import { requireAuth } from "../middleware/auth";
import { jsonData, jsonError } from "../lib/response";
import { detectLangFromDocument } from "../lib/lang";
import { chatComplete } from "../services/mistral";
import { buildVirtualPersonaPrompt } from "../prompts/virtual-persona";
import { getRandomIconUrlForGender } from "../lib/fox-icons";
import { buildSpeedDatingSystemPrompt } from "../prompts/speed-dating";
import { z } from "zod";

const speedDating = new Hono<Env>();

const FEMALE_VOICE_IDS = [
	"9BWtsMINqrJLrRacOk9x", // Aria
	"EXAVITQu4vr4xnSDxMaL", // Sarah
	"AZnzlk1XvdvUeBnXmlld", // Domi
	"MF3mGyEYCl7XYWbV9V6O", // Elli
	"ThT5KcBeYPX3keUQqHPh", // Dorothy
];
const MALE_VOICE_IDS = [
	"CwhRBWXzGAHq8TQ4Fs17", // Roger
	"JBFqnCBsd6RMkjVDRZzb", // George
	"ErXwobaYiN019PkySvjV", // Antoni
	"TxGEqnHWrfWFTfGW9XjX", // Josh
	"VR6AewLTigWG4xSOukaG", // Arnold
];

const PERSONA_TYPE_OFFSETS: Record<string, number> = {
	virtual_similar: 0,
	virtual_complementary: 1,
	virtual_discovery: 2,
};

function pickVoiceId(
	gender: "male" | "female",
	personaType: string | undefined,
	indexSeed: number,
): string {
	const voices = gender === "male" ? MALE_VOICE_IDS : FEMALE_VOICE_IDS;
	const baseOffset = PERSONA_TYPE_OFFSETS[personaType ?? ""] ?? 0;
	return voices[(baseOffset + indexSeed) % voices.length];
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
	if (/男性|彼は|おじさん|お兄さん|\bhe\b|\bhis\b/i.test(compiledDocument)) return "male";
	return "female";
}

function detectLangFromHeader(c: { req: { header: (name: string) => string | undefined } }): "ja" | "en" {
	const accept = c.req.header("accept-language") ?? "";
	return accept.startsWith("en") ? "en" : "ja";
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
	let name = "";
	let gender: "male" | "female" = "female";
	const lines = text.split("\n");
	let currentSection = "";
	let currentContent: string[] = [];

	for (const line of lines) {
		if (line.startsWith("name:")) {
			name = line.replace(/^name:\s*/, "").trim().replace(/[*_#`"'"'「」]/g, "");
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
			// Japanese headers
			if (currentSection === "コアアイデンティティ") currentSection = "core_identity";
			else if (currentSection === "コミュニケーションルール") currentSection = "communication_rules";
			else if (currentSection === "パーソナリティプロファイル") currentSection = "personality_profile";
			else if (currentSection === "興味・関心マップ") currentSection = "interests";
			else if (currentSection === "価値観") currentSection = "values";
			else if (currentSection === "制約事項") currentSection = "constraints";
			// English headers
			else if (currentSection === "core_identity") { /* already correct */ }
			else if (currentSection === "communication_rules") { /* already correct */ }
			else if (currentSection === "personality_profile") { /* already correct */ }
			else if (currentSection === "interests_map") currentSection = "interests";
			else if (currentSection === "values") { /* already correct */ }
			else if (currentSection === "constraints") { /* already correct */ }
			currentContent = [];
		} else {
			currentContent.push(line);
		}
	}
	if (currentSection) {
		sections[currentSection] = currentContent.join("\n").trim();
	}

	// Fallback: if the LLM embedded the name inside the core identity text
	// instead of outputting it as a separate "name:" line, try to extract it.
	if (!name && sections.core_identity) {
		const nameMatch = sections.core_identity.match(/(?:名前|name)[：:]\s*(.+?)(?:[。.、,\n]|$)/i);
		if (nameMatch?.[1]) {
			name = nameMatch[1].trim().replace(/[*_#`"'"'「」]/g, "");
		}
	}

	return { name: name || "ペルソナ", gender, sections };
}

/** POST /api/speed-dating/personas - generate 3 virtual personas */
speedDating.post("/personas", requireAuth, async (c) => {
	const userId = c.get("user_id");
	const lang = detectLangFromHeader(c);
	const apiKey = c.env.MISTRAL_API_KEY;
	if (!apiKey) {
		return jsonError(c, "INTERNAL_ERROR", "Mistral API not configured");
	}
	const supabase = getSupabaseClient(c.env);

	// ユーザーの性別に応じてペルソナの性別を逆にする（女性ユーザー→男性ペルソナ、男性ユーザー→女性ペルソナ）
	const { data: userProfile } = await supabase
		.from("user_profiles")
		.select("gender")
		.eq("id", userId)
		.single();
	const userGender = (userProfile?.gender ?? "").toLowerCase();
	const personaGender: "male" | "female" =
		userGender === "female" ? "male" : userGender === "male" ? "female" : "female";

	const { data: answers } = await supabase
		.from("quiz_answers")
		.select("question_id, selected")
		.eq("user_id", userId);
	const quizSummary = JSON.stringify(answers ?? [], null, 2);

	const types = ["virtual_similar", "virtual_complementary", "virtual_discovery"] as const;

	// Generate personas sequentially so each can avoid names used by previous ones
	const usedNames: string[] = [];
	const rawResults: { personaType: typeof types[number]; raw: string }[] = [];
	for (const personaType of types) {
		const prompt = buildVirtualPersonaPrompt(quizSummary, personaType, usedNames, lang, personaGender);
		const raw = await chatComplete(
			apiKey,
			[{ role: "user", content: prompt }],
			{ maxTokens: 1500, temperature: 1.0 },
		);
		const nameMatch = raw.match(/^name:\s*(.+)/m);
		if (nameMatch?.[1]) usedNames.push(nameMatch[1].trim());
		rawResults.push({ personaType, raw });
	}

	// Save to DB in parallel
	const results = await Promise.all(
		rawResults.map(async ({ personaType, raw }) => {
			const { name, sections } = parsePersonaMarkdown(raw);
			const iconUrl = getRandomIconUrlForGender(personaGender);
			const { data: persona, error: insertErr } = await supabase
				.from("personas")
				.upsert(
					{
						user_id: userId,
						persona_type: personaType,
						name: name || personaType,
						compiled_document: raw,
						icon_url: iconUrl,
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
		.select("id, status, personas(compiled_document, name, persona_type)")
		.eq("id", id)
		.eq("user_id", userId)
		.single();
	const sessionQueryMs = Date.now() - sessionQueryStartedAt;
	if (!session) return jsonError(c, "NOT_FOUND", "Session not found");
	if (session.status === "completed") return jsonError(c, "BAD_REQUEST", "Session already completed");
	const persona = Array.isArray(session.personas) ? session.personas[0] : session.personas;
	if (!persona) return jsonError(c, "NOT_FOUND", "Persona not found");
	const lang = detectLangFromDocument(persona.compiled_document);
	const systemPrompt = buildSpeedDatingSystemPrompt(persona.compiled_document, lang);
	const gender = detectGender(persona.compiled_document);
	const voiceId = pickVoiceId(
		gender,
		persona.persona_type,
		stableIndexFromString(persona.name || session.id),
	);

	// Generate first message + fetch signed URL in parallel
	const cleanName = persona.name.replace(/[*_#`"'"']/g, "");
	const firstMessagePromise = (async () => {
		const apiKey = c.env.MISTRAL_API_KEY;
		if (!apiKey) return null;
		const fmPrompt = lang === "en"
			? `You are ${cleanName} at a speed dating event. Write your opening greeting (1-2 sentences). Start by saying hi and your name, then add ONE short casual comment about your mood or how you're feeling tonight. Keep it simple and natural — like how a real person would greet a stranger on a first date. No Markdown.\n\nExample tone: "Hey, I'm Sakura! I just came from work so I'm a little tired, but honestly excited to be here."\n\nPersona for reference (use lightly — do NOT quote or describe details from this):\n${persona.compiled_document}\n\nWrite ONLY the greeting. Plain text, 1-2 sentences max.`
			: `あなたは${cleanName}です。スピードデートの席に着いたところです。最初の挨拶を1〜2文で書いてください。まず「はじめまして、${cleanName}です」のように名乗ってから、今の気分やひとことだけ軽く添えてください。初対面の人に話しかけるような自然なトーンで。変に凝ったり個性的にしようとしないで、普通の挨拶で大丈夫です。Markdown記法は使わないでください。\n\n参考例:「はじめまして、さくらです！仕事帰りでちょっと疲れてるけど、楽しみにしてました〜」\n\nペルソナ情報（軽く参考にする程度で、ここから引用したり詳細を語らないこと）:\n${persona.compiled_document}\n\n挨拶だけをプレーンテキストで出力してください。1〜2文まで。`;
		try {
			return await chatComplete(apiKey, [{ role: "user", content: fmPrompt }], { maxTokens: 100 });
		} catch {
			return null;
		}
	})();

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

	const generatedFirstMessage = await firstMessagePromise;
	const fallback = lang === "en"
		? `Hi! I'm ${cleanName}. Nice to meet you!`
		: `はじめまして！${cleanName}です。よろしくね！`;
	const firstMessage = generatedFirstMessage?.trim() || fallback;
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
				language: lang === "en" ? "en" : "ja",
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
	const lang = persona ? detectLangFromDocument(persona.compiled_document) : "ja";
	let personaContent = lang === "en" ? "(Failed to generate response)" : "（応答を生成できませんでした）";
	const apiKey = c.env.MISTRAL_API_KEY;
	if (apiKey && persona) {
		const systemPrompt = buildSpeedDatingSystemPrompt(persona.compiled_document, lang);
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
