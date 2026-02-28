import { Hono } from "hono";
import type { Env } from "../env";
import { getSupabaseClient } from "../db/client";
import { requireAuth } from "../middleware/auth";
import { jsonData, jsonError } from "../lib/response";
import { searchAndStartMultipleFoxConversations } from "../services/fox-search";
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

	// Search and create multiple matches + fox_conversations
	let results: Array<{ match_id: string; fox_conversation_id: string; partner_user_id: string }>;
	try {
		results = await searchAndStartMultipleFoxConversations(supabase, userId);
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

	// Run fox conversations: prefer Durable Object (Cloudflare Workers),
	// fall back to waitUntil / detached promise (Node.js dev server).
	// DOs: stagger init with 3s delay between each to avoid Mistral rate limits.
	// Non-DO: run sequentially in background to avoid rate limits.
	if (c.env.FOX_CONVERSATION) {
		const STAGGER_INTERVAL_MS = 3000;
		for (let i = 0; i < results.length; i++) {
			const result = results[i];
			try {
				const doId = c.env.FOX_CONVERSATION.idFromName(result.fox_conversation_id);
				const stub = c.env.FOX_CONVERSATION.get(doId);
				await stub.fetch(
					new Request("https://do/init", {
						method: "POST",
						body: JSON.stringify({
							conversationId: result.fox_conversation_id,
							matchId: result.match_id,
							staggerDelayMs: i * STAGGER_INTERVAL_MS,
						}),
					}),
				);
			} catch (err) {
				console.error(`Failed to start DO for ${result.fox_conversation_id}:`, err);
			}
		}
	} else {
		const bgTask = (async () => {
			for (const result of results) {
				try {
					await runFoxConversation(supabase, apiKey, result.fox_conversation_id);
				} catch (err) {
					console.error(`Fox conversation failed (${result.fox_conversation_id}):`, err);
					await supabase
						.from("fox_conversations")
						.update({ status: "failed" })
						.eq("id", result.fox_conversation_id);
					await supabase
						.from("matches")
						.update({ status: "fox_conversation_failed" })
						.eq("id", result.match_id);
				}
			}
		})();
		try {
			c.executionCtx.waitUntil(bgTask);
		} catch {
			// Node.js dev server — promise runs detached
		}
	}

	return jsonData(c, {
		conversations: results.map((r) => ({
			match_id: r.match_id,
			fox_conversation_id: r.fox_conversation_id,
		})),
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

/** POST /api/fox-search/retry/:matchId — retry a failed fox conversation */
foxSearch.post("/retry/:matchId", requireAuth, async (c) => {
	const userId = c.get("user_id");
	const matchId = c.req.param("matchId");
	const supabase = getSupabaseClient(c.env);
	const apiKey = c.env.MISTRAL_API_KEY;
	if (!apiKey) return jsonError(c, "INTERNAL_ERROR", "Mistral API not configured");

	// 1. Verify match exists and user has access
	const { data: match } = await supabase
		.from("matches")
		.select("id, user_a_id, user_b_id, status")
		.eq("id", matchId)
		.single();
	if (!match || (match.user_a_id !== userId && match.user_b_id !== userId)) {
		return jsonError(c, "NOT_FOUND", "Match not found");
	}
	if (match.status !== "fox_conversation_failed") {
		return jsonError(c, "BAD_REQUEST", "Match is not in a failed state");
	}

	// 2. Get the fox conversation
	const { data: foxConv } = await supabase
		.from("fox_conversations")
		.select("id, status")
		.eq("match_id", matchId)
		.single();
	if (!foxConv) return jsonError(c, "NOT_FOUND", "Fox conversation not found");

	// 3. Delete existing messages (clean start)
	await supabase
		.from("fox_conversation_messages")
		.delete()
		.eq("conversation_id", foxConv.id);

	// 4. Reset fox_conversations status
	await supabase
		.from("fox_conversations")
		.update({ status: "in_progress", current_round: 0, completed_at: null })
		.eq("id", foxConv.id);

	// 5. Reset match status
	await supabase
		.from("matches")
		.update({ status: "fox_conversation_in_progress" })
		.eq("id", matchId);

	// 6. Re-run the fox conversation
	if (c.env.FOX_CONVERSATION) {
		try {
			const doId = c.env.FOX_CONVERSATION.idFromName(foxConv.id);
			const stub = c.env.FOX_CONVERSATION.get(doId);
			await stub.fetch(
				new Request("https://do/init", {
					method: "POST",
					body: JSON.stringify({
						conversationId: foxConv.id,
						matchId: matchId,
						staggerDelayMs: 0,
					}),
				}),
			);
		} catch (err) {
			console.error(`Failed to start DO for retry ${foxConv.id}:`, err);
			return jsonError(c, "INTERNAL_ERROR", "Failed to restart conversation");
		}
	} else {
		const bgTask = (async () => {
			try {
				await runFoxConversation(supabase, apiKey, foxConv.id);
			} catch (err) {
				console.error(`Fox conversation retry failed (${foxConv.id}):`, err);
				await supabase
					.from("fox_conversations")
					.update({ status: "failed" })
					.eq("id", foxConv.id);
				await supabase
					.from("matches")
					.update({ status: "fox_conversation_failed" })
					.eq("id", matchId);
			}
		})();
		try {
			c.executionCtx.waitUntil(bgTask);
		} catch {
			// Node.js dev server — promise runs detached
		}
	}

	return jsonData(c, {
		match_id: matchId,
		fox_conversation_id: foxConv.id,
	});
});

export default foxSearch;
