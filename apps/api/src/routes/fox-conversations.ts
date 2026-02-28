import { Hono } from "hono";
import type { Env } from "../env";
import { getSupabaseClient } from "../db/client";
import { requireAuth } from "../middleware/auth";
import { jsonData, jsonError } from "../lib/response";

const foxConversations = new Hono<Env>();

/** GET /api/fox-conversations/:id */
foxConversations.get("/:id", requireAuth, async (c) => {
	const userId = c.get("user_id");
	const id = c.req.param("id");
	const supabase = getSupabaseClient(c.env);
	const { data: conv, error } = await supabase.from("fox_conversations").select("*").eq("id", id).single();
	if (error || !conv) return jsonError(c, "NOT_FOUND", "Conversation not found");
	const { data: match } = await supabase.from("matches").select("user_a_id, user_b_id").eq("id", conv.match_id).single();
	if (!match || (match.user_a_id !== userId && match.user_b_id !== userId)) {
		return jsonError(c, "FORBIDDEN", "Access denied");
	}
	return jsonData(c, conv);
});

/** GET /api/fox-conversations/:id/messages */
foxConversations.get("/:id/messages", requireAuth, async (c) => {
	const userId = c.get("user_id");
	const id = c.req.param("id");
	const limit = Math.min(Number(c.req.query("limit")) || 50, 100);
	const cursor = c.req.query("cursor");
	const supabase = getSupabaseClient(c.env);
	const { data: conv } = await supabase.from("fox_conversations").select("match_id").eq("id", id).single();
	if (!conv) return jsonError(c, "NOT_FOUND", "Conversation not found");
	const { data: match } = await supabase.from("matches").select("user_a_id, user_b_id").eq("id", conv.match_id).single();
	if (!match || (match.user_a_id !== userId && match.user_b_id !== userId)) {
		return jsonError(c, "FORBIDDEN", "Access denied");
	}
	let q = supabase
		.from("fox_conversation_messages")
		.select("id, speaker_user_id, content, round_number, created_at")
		.eq("conversation_id", id)
		.order("round_number");
	if (cursor) q = q.lt("created_at", cursor);
	const { data: rows } = await q.limit(limit + 1);
	const hasMore = (rows?.length ?? 0) > limit;
	const list = (rows ?? []).slice(0, limit);
	const myId = userId;
	const formatted = list.map((m) => ({
		id: m.id,
		speaker: m.speaker_user_id === myId ? "my_fox" : "partner_fox",
		content: m.content,
		round_number: m.round_number,
		created_at: m.created_at,
	}));
	return c.json({
		data: formatted,
		next_cursor: hasMore ? list[list.length - 1]?.created_at ?? null : null,
		has_more: hasMore,
	});
});

export default foxConversations;
