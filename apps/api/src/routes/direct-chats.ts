import { Hono } from "hono";
import type { Env } from "../env";
import { getSupabaseClient } from "../db/client";
import { requireAuth } from "../middleware/auth";
import { jsonData, jsonError } from "../lib/response";
import { z } from "zod";

const directChats = new Hono<Env>();

const postMessageSchema = z.object({ content: z.string().min(1).max(1000) });

/** GET /api/direct-chats */
directChats.get("/", requireAuth, async (c) => {
	const userId = c.get("user_id");
	const supabase = getSupabaseClient(c.env);
	const { data: profile } = await supabase
		.from("user_profiles")
		.select("notification_seen_at")
		.eq("id", userId)
		.single();
	const notificationSeenAt = profile?.notification_seen_at ?? null;

	const { data: myMatches } = await supabase.from("matches").select("id, user_a_id, user_b_id").or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`);
	const matchIds = (myMatches ?? []).map((m) => m.id);
	const { data: rooms } = await supabase.from("direct_chat_rooms").select("id, match_id").eq("status", "active").in("match_id", matchIds);
	const roomIdByMatch = new Map((myMatches ?? []).map((m) => [m.id, m]));
	const roomsForUser = rooms ?? [];
	const partnerIds = roomsForUser.map((r) => {
		const m = roomIdByMatch.get(r.match_id);
		return m && (m.user_a_id === userId ? m.user_b_id : m.user_a_id);
	}).filter(Boolean) as string[];
	const { data: partners } = await supabase.from("user_profiles").select("id, nickname, avatar_url").in("id", partnerIds);
	const partnerMap = new Map((partners ?? []).map((p) => [p.id, p]));
	const results = await Promise.all(
		roomsForUser.map(async (r) => {
			const m = roomIdByMatch.get(r.match_id);
			const partnerId = m && (m.user_a_id === userId ? m.user_b_id : m.user_a_id);
			const partner = partnerId ? partnerMap.get(partnerId) : null;
			const { data: lastMsg } = await supabase
				.from("direct_chat_messages")
				.select("content, created_at, sender_id")
				.eq("room_id", r.id)
				.order("created_at", { ascending: false })
				.limit(1)
				.single();
			const { count } = await supabase
				.from("direct_chat_messages")
				.select("id", { count: "exact", head: true })
				.eq("room_id", r.id)
				.neq("sender_id", userId)
				.eq("is_read", false);
			const unreadCount = count ?? 0;
			let unreadCountAfterSeen = unreadCount;
			if (notificationSeenAt) {
				const { count: countAfter } = await supabase
					.from("direct_chat_messages")
					.select("id", { count: "exact", head: true })
					.eq("room_id", r.id)
					.neq("sender_id", userId)
					.eq("is_read", false)
					.gt("created_at", notificationSeenAt);
				unreadCountAfterSeen = countAfter ?? 0;
			}
			return {
				id: r.id,
				match_id: r.match_id,
				partner: partner ? { nickname: partner.nickname, avatar_url: partner.avatar_url } : null,
				last_message: lastMsg ? { content: lastMsg.content, created_at: lastMsg.created_at, is_mine: lastMsg.sender_id === userId } : null,
				unread_count: unreadCount,
				unread_count_after_seen: unreadCountAfterSeen,
				status: "active",
			};
		}),
	);
	return jsonData(c, results);
});

/** GET /api/direct-chats/:id/messages */
directChats.get("/:id/messages", requireAuth, async (c) => {
	const userId = c.get("user_id");
	const id = c.req.param("id");
	const limit = Math.min(Number(c.req.query("limit")) || 50, 100);
	const cursor = c.req.query("cursor");
	const supabase = getSupabaseClient(c.env);
	const { data: room } = await supabase.from("direct_chat_rooms").select("match_id").eq("id", id).single();
	if (!room) return jsonError(c, "NOT_FOUND", "Room not found");
	const { data: match } = await supabase.from("matches").select("user_a_id, user_b_id").eq("id", room.match_id).single();
	if (!match || (match.user_a_id !== userId && match.user_b_id !== userId)) return jsonError(c, "FORBIDDEN", "Access denied");
	let q = supabase
		.from("direct_chat_messages")
		.select("id, sender_id, content, is_read, created_at")
		.eq("room_id", id)
		.order("created_at", { ascending: false });
	if (cursor) q = q.lt("created_at", cursor);
	const { data: rows } = await q.limit(limit + 1);
	const hasMore = (rows?.length ?? 0) > limit;
	const list = (rows ?? []).slice(0, limit).reverse();
	const formatted = list.map((m) => ({
		id: m.id,
		sender_id: m.sender_id,
		is_mine: m.sender_id === userId,
		content: m.content,
		is_read: m.is_read,
		created_at: m.created_at,
	}));
	return c.json({ data: formatted, next_cursor: hasMore ? list[0]?.created_at ?? null : null, has_more: hasMore });
});

/** POST /api/direct-chats/:id/messages */
directChats.post("/:id/messages", requireAuth, async (c) => {
	const userId = c.get("user_id");
	const id = c.req.param("id");
	const parsed = postMessageSchema.safeParse(await c.req.json());
	if (!parsed.success) return jsonError(c, "BAD_REQUEST", parsed.error.message);
	const supabase = getSupabaseClient(c.env);
	const { data: room } = await supabase.from("direct_chat_rooms").select("match_id").eq("id", id).single();
	if (!room) return jsonError(c, "NOT_FOUND", "Room not found");
	const { data: match } = await supabase.from("matches").select("user_a_id, user_b_id").eq("id", room.match_id).single();
	if (!match || (match.user_a_id !== userId && match.user_b_id !== userId)) return jsonError(c, "FORBIDDEN", "Access denied");
	const { data: msg, error } = await supabase
		.from("direct_chat_messages")
		.insert({ room_id: id, sender_id: userId, content: parsed.data.content })
		.select("id, content, created_at")
		.single();
	if (error) return jsonError(c, "INTERNAL_ERROR", "Failed to send");
	return jsonData(c, msg);
});

/** PUT /api/direct-chats/:id/messages/:messageId/read */
directChats.put("/:id/messages/:messageId/read", requireAuth, async (c) => {
	const userId = c.get("user_id");
	const id = c.req.param("id");
	const messageId = c.req.param("messageId");
	const supabase = getSupabaseClient(c.env);
	const { data: room } = await supabase.from("direct_chat_rooms").select("match_id").eq("id", id).single();
	if (!room) return jsonError(c, "NOT_FOUND", "Room not found");
	const { data: match } = await supabase.from("matches").select("user_a_id, user_b_id").eq("id", room.match_id).single();
	if (!match || (match.user_a_id !== userId && match.user_b_id !== userId)) return jsonError(c, "FORBIDDEN", "Access denied");
	const { data: target } = await supabase.from("direct_chat_messages").select("id, created_at").eq("id", messageId).eq("room_id", id).single();
	if (!target) return jsonError(c, "NOT_FOUND", "Message not found");
	const { count } = await supabase
		.from("direct_chat_messages")
		.update({ is_read: true })
		.eq("room_id", id)
		.neq("sender_id", userId)
		.lte("created_at", target.created_at);
	return jsonData(c, { read_count: count ?? 0 });
});

export default directChats;
