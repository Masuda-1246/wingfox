import { Hono } from "hono";
import type { Env } from "../env";
import { getSupabaseClient } from "../db/client";
import { requireAuth } from "../middleware/auth";
import { jsonData, jsonError } from "../lib/response";
import { searchAndStartFoxConversation } from "../services/fox-search";
import { runFoxConversation } from "../services/fox-conversation";

const foxSearch = new Hono<Env>();

/** POST /api/fox-search/start — search for a partner fox and start conversation */
foxSearch.post("/start", requireAuth, async (c) => {
	const userId = c.get("user_id");
	const supabase = getSupabaseClient(c.env);
	const apiKey = c.env.MISTRAL_API_KEY;
	if (!apiKey) return jsonError(c, "INTERNAL_ERROR", "Mistral API not configured");

	// Guard: reject if user already has an in_progress fox conversation
	const { data: userMatches } = await supabase
		.from("matches")
		.select("id")
		.or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`);

	if (userMatches && userMatches.length > 0) {
		const { data: activeConvs } = await supabase
			.from("fox_conversations")
			.select("id")
			.in("match_id", userMatches.map((m) => m.id))
			.eq("status", "in_progress")
			.limit(1);

		if (activeConvs && activeConvs.length > 0) {
			return jsonError(c, "CONFLICT", "A fox conversation is already in progress");
		}
	}

	// Search and create match + fox_conversation
	let result: { match_id: string; fox_conversation_id: string; partner_user_id: string };
	try {
		result = await searchAndStartFoxConversation(supabase, userId);
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : "Unknown error";
		if (msg === "WINGFOX_PERSONA_NOT_FOUND") {
			return jsonError(c, "BAD_REQUEST", "You need a wingfox persona first");
		}
		if (msg === "NO_CANDIDATES_FOUND") {
			return jsonError(c, "NOT_FOUND", "No eligible partners found");
		}
		return jsonError(c, "INTERNAL_ERROR", msg);
	}

	// Run fox conversation in the background.
	// Use waitUntil when available (Cloudflare Workers) to keep the worker alive,
	// otherwise fall back to a detached promise (Node.js dev server).
	const bgTask = runFoxConversation(supabase, apiKey, result.fox_conversation_id).catch(
		async (err) => {
			console.error("Fox conversation failed:", err);
			await supabase
				.from("fox_conversations")
				.update({ status: "failed" })
				.eq("id", result.fox_conversation_id);
		},
	);
	try {
		c.executionCtx.waitUntil(bgTask);
	} catch {
		// Node.js dev server — promise runs detached
	}

	return jsonData(c, {
		match_id: result.match_id,
		fox_conversation_id: result.fox_conversation_id,
	});
});

/** GET /api/fox-search/status/:conversationId — poll conversation progress */
foxSearch.get("/status/:conversationId", requireAuth, async (c) => {
	const userId = c.get("user_id");
	const conversationId = c.req.param("conversationId");
	const supabase = getSupabaseClient(c.env);

	const { data: conv, error } = await supabase
		.from("fox_conversations")
		.select("id, match_id, status, current_round, total_rounds, completed_at")
		.eq("id", conversationId)
		.single();
	if (error || !conv) return jsonError(c, "NOT_FOUND", "Conversation not found");

	// Verify user has access via match
	const { data: match } = await supabase
		.from("matches")
		.select("user_a_id, user_b_id")
		.eq("id", conv.match_id)
		.single();
	if (!match || (match.user_a_id !== userId && match.user_b_id !== userId)) {
		return jsonError(c, "FORBIDDEN", "Access denied");
	}

	return jsonData(c, {
		status: conv.status,
		current_round: conv.current_round,
		total_rounds: conv.total_rounds,
		completed_at: conv.completed_at,
	});
});

export default foxSearch;
