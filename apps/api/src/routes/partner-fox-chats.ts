import { Hono } from "hono";
import type { Env } from "../env";
import { getSupabaseClient } from "../db/client";
import { requireAuth } from "../middleware/auth";
import { jsonData, jsonError } from "../lib/response";
import { chatComplete } from "../services/mistral";
import { buildSpeedDatingSystemPrompt } from "../prompts/speed-dating";
import { z } from "zod";

const partnerFoxChats = new Hono<Env>();

const postChatSchema = z.object({ match_id: z.string().uuid() });
const postMessageSchema = z.object({ content: z.string().min(1).max(2000) });

/** POST /api/partner-fox-chats */
partnerFoxChats.post("/", requireAuth, async (c) => {
	const userId = c.get("user_id");
	const parsed = postChatSchema.safeParse(await c.req.json());
	if (!parsed.success) return jsonError(c, "BAD_REQUEST", parsed.error.message);
	const supabase = getSupabaseClient(c.env);
	const { data: match } = await supabase
		.from("matches")
		.select("user_a_id, user_b_id")
		.eq("id", parsed.data.match_id)
		.single();
	if (!match || (match.user_a_id !== userId && match.user_b_id !== userId)) {
		return jsonError(c, "NOT_FOUND", "Match not found");
	}
	const partnerUserId = match.user_a_id === userId ? match.user_b_id : match.user_a_id;
	const { data: fc } = await supabase.from("fox_conversations").select("status").eq("match_id", parsed.data.match_id).single();
	if (!fc || fc.status !== "completed") return jsonError(c, "CONFLICT", "Fox conversation not completed");
	const { data: existing } = await supabase.from("partner_fox_chats").select("id").eq("match_id", parsed.data.match_id).eq("user_id", userId).single();
	if (existing) return jsonError(c, "CONFLICT", "Chat already started");
	const { data: partnerPersona } = await supabase
		.from("personas")
		.select("compiled_document")
		.eq("user_id", partnerUserId)
		.eq("persona_type", "wingfox")
		.single();
	const { data: partnerProfile } = await supabase.from("user_profiles").select("nickname").eq("id", partnerUserId).single();
	const partnerName = partnerProfile?.nickname ?? "相手";
	const { data: chat, error } = await supabase
		.from("partner_fox_chats")
		.insert({ match_id: parsed.data.match_id, user_id: userId, partner_user_id: partnerUserId })
		.select("id")
		.single();
	if (error || !chat) return jsonError(c, "INTERNAL_ERROR", "Failed to create chat");
	await supabase.from("matches").update({ status: "partner_chat_started", updated_at: new Date().toISOString() }).eq("id", parsed.data.match_id);
	let firstContent = "よろしくお願いします。";
	const apiKey = c.env.MISTRAL_API_KEY;
	if (apiKey && partnerPersona?.compiled_document) {
		const systemPrompt = `${buildSpeedDatingSystemPrompt(partnerPersona.compiled_document)}\n\n相手のユーザーから直接話しかけられています。${partnerName}さんならこう話すだろう、という形で自然に挨拶してください。挨拶は短く1文で。『こんにちは』は一度だけか、省略してもよい。`;
		firstContent = await chatComplete(apiKey, [
			{ role: "system", content: systemPrompt },
			{ role: "user", content: "挨拶をしてください。" },
		]);
	}
	const { data: firstMsg } = await supabase
		.from("partner_fox_messages")
		.insert({ chat_id: chat.id, role: "fox", content: firstContent })
		.select("id, role, content, created_at")
		.single();
	return jsonData(c, {
		id: chat.id,
		match_id: parsed.data.match_id,
		partner: { nickname: partnerName },
		first_message: firstMsg ?? { id: "", role: "fox", content: firstContent, created_at: new Date().toISOString() },
	});
});

/** GET /api/partner-fox-chats/:id */
partnerFoxChats.get("/:id", requireAuth, async (c) => {
	const userId = c.get("user_id");
	const id = c.req.param("id");
	const supabase = getSupabaseClient(c.env);
	const { data: chat, error } = await supabase.from("partner_fox_chats").select("*").eq("id", id).eq("user_id", userId).single();
	if (error || !chat) return jsonError(c, "NOT_FOUND", "Chat not found");
	const { data: partner } = await supabase.from("user_profiles").select("nickname").eq("id", chat.partner_user_id).single();
	return jsonData(c, { ...chat, partner: partner ?? { nickname: "相手" } });
});

/** GET /api/partner-fox-chats/:id/messages */
partnerFoxChats.get("/:id/messages", requireAuth, async (c) => {
	const userId = c.get("user_id");
	const id = c.req.param("id");
	const supabase = getSupabaseClient(c.env);
	const { data: chat } = await supabase.from("partner_fox_chats").select("id").eq("id", id).eq("user_id", userId).single();
	if (!chat) return jsonError(c, "NOT_FOUND", "Chat not found");
	const { data: messages } = await supabase
		.from("partner_fox_messages")
		.select("id, role, content, created_at")
		.eq("chat_id", id)
		.order("created_at");
	return c.json({ data: messages ?? [], next_cursor: null, has_more: false });
});

/** POST /api/partner-fox-chats/:id/messages */
partnerFoxChats.post("/:id/messages", requireAuth, async (c) => {
	const userId = c.get("user_id");
	const id = c.req.param("id");
	const parsed = postMessageSchema.safeParse(await c.req.json());
	if (!parsed.success) return jsonError(c, "BAD_REQUEST", parsed.error.message);
	const supabase = getSupabaseClient(c.env);
	const { data: chat } = await supabase.from("partner_fox_chats").select("id, partner_user_id").eq("id", id).eq("user_id", userId).single();
	if (!chat) return jsonError(c, "NOT_FOUND", "Chat not found");
	const { data: persona } = await supabase
		.from("personas")
		.select("compiled_document")
		.eq("user_id", chat.partner_user_id)
		.eq("persona_type", "wingfox")
		.single();
	await supabase.from("partner_fox_messages").insert({ chat_id: id, role: "user", content: parsed.data.content });
	const { data: history } = await supabase
		.from("partner_fox_messages")
		.select("role, content")
		.eq("chat_id", id)
		.order("created_at");
	const messagesForAi = (history ?? []).map((m) => ({ role: m.role === "user" ? "user" as const : "assistant" as const, content: m.content }));
	let foxContent = "（応答を生成できませんでした）";
	const apiKey = c.env.MISTRAL_API_KEY;
	if (apiKey && persona?.compiled_document) {
		const systemPrompt = buildSpeedDatingSystemPrompt(persona.compiled_document);
		foxContent = await chatComplete(apiKey, [{ role: "system", content: systemPrompt }, ...messagesForAi], { maxTokens: 512 });
	}
	const { data: foxMsg } = await supabase
		.from("partner_fox_messages")
		.insert({ chat_id: id, role: "fox", content: foxContent })
		.select("id, role, content, created_at")
		.single();
	return jsonData(c, {
		user_message: { id: "", role: "user", content: parsed.data.content, created_at: new Date().toISOString() },
		fox_message: foxMsg ?? { id: "", role: "fox", content: foxContent, created_at: new Date().toISOString() },
	});
});

export default partnerFoxChats;
