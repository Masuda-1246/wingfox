import { Hono } from "hono";
import type { Env } from "../env";
import { getSupabaseClient } from "../db/client";
import { requireAuth } from "../middleware/auth";
import { jsonData, jsonError } from "../lib/response";
import { z } from "zod";

const chatRequests = new Hono<Env>();

const postSchema = z.object({ match_id: z.string().uuid() });
const putSchema = z.object({ action: z.enum(["accept", "decline"]) });

/** POST /api/chat-requests */
chatRequests.post("/", requireAuth, async (c) => {
	const userId = c.get("user_id");
	const parsed = postSchema.safeParse(await c.req.json());
	if (!parsed.success) return jsonError(c, "BAD_REQUEST", parsed.error.message);
	const supabase = getSupabaseClient(c.env);
	const { data: match } = await supabase.from("matches").select("user_a_id, user_b_id").eq("id", parsed.data.match_id).single();
	if (!match || (match.user_a_id !== userId && match.user_b_id !== userId)) return jsonError(c, "NOT_FOUND", "Match not found");
	const partnerId = match.user_a_id === userId ? match.user_b_id : match.user_a_id;
	const { data: pfc } = await supabase.from("partner_fox_chats").select("id").eq("match_id", parsed.data.match_id).eq("user_id", userId).single();
	if (!pfc) return jsonError(c, "CONFLICT", "Partner fox chat not started");
	const { data: existing } = await supabase.from("chat_requests").select("id").eq("match_id", parsed.data.match_id).single();
	if (existing) return jsonError(c, "CONFLICT", "Request already sent");
	const expiresAt = new Date();
	expiresAt.setHours(expiresAt.getHours() + 48);
	const { data: req, error } = await supabase
		.from("chat_requests")
		.insert({
			match_id: parsed.data.match_id,
			requester_id: userId,
			responder_id: partnerId,
			expires_at: expiresAt.toISOString(),
		})
		.select("id, match_id, status, expires_at")
		.single();
	if (error || !req) return jsonError(c, "INTERNAL_ERROR", "Failed to create request");
	const { error: matchUpdateError } = await supabase.from("matches").update({ status: "direct_chat_requested", updated_at: new Date().toISOString() }).eq("id", parsed.data.match_id);
	if (matchUpdateError) {
		// Compensate: delete the chat_request we just created
		await supabase.from("chat_requests").delete().eq("id", req.id);
		return jsonError(c, "INTERNAL_ERROR", "Failed to update match status");
	}
	return jsonData(c, req);
});

/** GET /api/chat-requests - list received pending */
chatRequests.get("/", requireAuth, async (c) => {
	const userId = c.get("user_id");
	const supabase = getSupabaseClient(c.env);
	const { data: list } = await supabase
		.from("chat_requests")
		.select("id, match_id, requester_id, status, expires_at, created_at")
		.eq("responder_id", userId)
		.eq("status", "pending")
		.gt("expires_at", new Date().toISOString());
	const requesterIds = [...new Set((list ?? []).map((r) => r.requester_id))];
	const { data: profiles } = await supabase.from("user_profiles").select("id, nickname").in("id", requesterIds);
	const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
	const matchIds = (list ?? []).map((r) => r.match_id);
	const { data: matches } = await supabase.from("matches").select("id, final_score").in("id", matchIds);
	const scoreMap = new Map((matches ?? []).map((m) => [m.id, m.final_score]));
	const results = (list ?? []).map((r) => ({
		...r,
		requester: profileMap.get(r.requester_id) ?? { nickname: "相手" },
		final_score: scoreMap.get(r.match_id),
	}));
	return jsonData(c, results);
});

/** PUT /api/chat-requests/:id */
chatRequests.put("/:id", requireAuth, async (c) => {
	const userId = c.get("user_id");
	const id = c.req.param("id");
	const parsed = putSchema.safeParse(await c.req.json());
	if (!parsed.success) return jsonError(c, "BAD_REQUEST", parsed.error.message);
	const supabase = getSupabaseClient(c.env);
	const { data: req } = await supabase.from("chat_requests").select("*").eq("id", id).eq("responder_id", userId).eq("status", "pending").single();
	if (!req) return jsonError(c, "NOT_FOUND", "Request not found");
	if (new Date(req.expires_at) < new Date()) {
		await supabase.from("chat_requests").update({ status: "expired" }).eq("id", id);
		return jsonError(c, "CONFLICT", "Request expired");
	}
	if (parsed.data.action === "decline") {
		await supabase.from("chat_requests").update({ status: "declined", responded_at: new Date().toISOString() }).eq("id", id);
		await supabase.from("matches").update({ status: "chat_request_declined", updated_at: new Date().toISOString() }).eq("id", req.match_id);
		return jsonData(c, { request_id: id, status: "declined" });
	}
	// Step 1: Create room
	const { data: room, error: roomErr } = await supabase
		.from("direct_chat_rooms")
		.insert({ match_id: req.match_id })
		.select("id")
		.single();
	if (roomErr || !room) return jsonError(c, "INTERNAL_ERROR", "Failed to create room");
	// Step 2: Update chat_request status
	const { error: crUpdateErr } = await supabase.from("chat_requests").update({ status: "accepted", responded_at: new Date().toISOString() }).eq("id", id);
	if (crUpdateErr) {
		// Compensate: delete the room
		await supabase.from("direct_chat_rooms").delete().eq("id", room.id);
		return jsonError(c, "INTERNAL_ERROR", "Failed to update chat request");
	}
	// Step 3: Update match status
	const { error: matchUpdateErr } = await supabase.from("matches").update({ status: "direct_chat_active", updated_at: new Date().toISOString() }).eq("id", req.match_id);
	if (matchUpdateErr) {
		// Compensate: rollback chat_request and delete room
		await supabase.from("chat_requests").update({ status: "pending", responded_at: null }).eq("id", id);
		await supabase.from("direct_chat_rooms").delete().eq("id", room.id);
		return jsonError(c, "INTERNAL_ERROR", "Failed to update match status");
	}
	return jsonData(c, { request_id: id, status: "accepted", direct_chat_room_id: room.id });
});

export default chatRequests;
