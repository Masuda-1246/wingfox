import { Hono } from "hono";
import type { Env } from "../env";
import { getSupabaseClient } from "../db/client";
import { jsonData, jsonError } from "../lib/response";
import { executeMatching } from "../services/matching";
import { runFoxConversation } from "../services/fox-conversation";

const internal = new Hono<Env>();

/** Minutes after which an in_progress fox_conversation is considered stuck */
const STUCK_IN_PROGRESS_MINUTES = 2;

/** POST /api/internal/matching/execute - run matching and create matches + fox_conversations */
internal.post("/matching/execute", async (c) => {
	const supabase = getSupabaseClient(c.env);
	const count = await executeMatching(supabase, 10);
	return jsonData(c, { message: "Matching executed", count });
});

/** POST /api/internal/fox-conversations/execute - run one or all pending fox conversations */
internal.post("/fox-conversations/execute", async (c) => {
	const supabase = getSupabaseClient(c.env);
	const apiKey = c.env.MISTRAL_API_KEY;
	if (!apiKey) return jsonError(c, "INTERNAL_ERROR", "Mistral API not configured");
	const body = (await c.req.json().catch(() => ({}))) as { conversation_id?: string };
	if (body.conversation_id) {
		await runFoxConversation(supabase, apiKey, body.conversation_id);
		return jsonData(c, { message: "Conversation executed" });
	}
	const { data: pending } = await supabase
		.from("fox_conversations")
		.select("id")
		.in("status", ["pending"])
		.limit(5);
	for (const row of pending ?? []) {
		await runFoxConversation(supabase, apiKey, row.id);
	}
	return jsonData(c, { message: "Batch executed", count: pending?.length ?? 0 });
});

/** POST /api/internal/chat-requests/expire */
internal.post("/chat-requests/expire", async (c) => {
	const supabase = getSupabaseClient(c.env);
	const { data } = await supabase
		.from("chat_requests")
		.update({ status: "expired" })
		.eq("status", "pending")
		.lt("expires_at", new Date().toISOString())
		.select("id, match_id");
	// Also update corresponding matches status
	for (const req of data ?? []) {
		await supabase
			.from("matches")
			.update({ status: "chat_request_expired", updated_at: new Date().toISOString() })
			.eq("id", req.match_id)
			.eq("status", "direct_chat_requested");
	}
	return jsonData(c, { message: "Expired", count: data?.length ?? 0 });
});

/** POST /api/internal/fox-conversations/retry-failed - reset failed fox conversations for retry */
internal.post("/fox-conversations/retry-failed", async (c) => {
	const supabase = getSupabaseClient(c.env);
	const { data: failed } = await supabase
		.from("fox_conversations")
		.select("id, match_id")
		.eq("status", "failed")
		.limit(10);
	if (!failed?.length) return jsonData(c, { message: "No failed conversations", count: 0 });
	let resetCount = 0;
	for (const conv of failed) {
		// Delete existing messages for a clean restart
		await supabase.from("fox_conversation_messages").delete().eq("conversation_id", conv.id);
		// Reset fox_conversation to pending
		await supabase
			.from("fox_conversations")
			.update({ status: "pending", current_round: 0, started_at: null, completed_at: null, conversation_analysis: null })
			.eq("id", conv.id);
		// Reset match status to fox_conversation_in_progress
		await supabase
			.from("matches")
			.update({ status: "fox_conversation_in_progress", updated_at: new Date().toISOString() })
			.eq("id", conv.match_id);
		resetCount++;
	}
	return jsonData(c, { message: "Failed conversations reset", count: resetCount });
});

/** POST /api/internal/data-integrity/check - detect and repair inconsistent data */
internal.post("/data-integrity/check", async (c) => {
	const supabase = getSupabaseClient(c.env);
	const fixes: string[] = [];

	// 1. Matches with fox_conversation_in_progress but no fox_conversation
	const { data: inProgressMatches } = await supabase
		.from("matches")
		.select("id")
		.eq("status", "fox_conversation_in_progress");
	for (const m of inProgressMatches ?? []) {
		const { data: fc } = await supabase
			.from("fox_conversations")
			.select("id")
			.eq("match_id", m.id)
			.limit(1);
		if (!fc?.length) {
			await supabase.from("matches").update({ status: "fox_conversation_failed", updated_at: new Date().toISOString() }).eq("id", m.id);
			fixes.push(`Match ${m.id}: fox_conversation_in_progress without fox_conversation -> fox_conversation_failed`);
		}
	}

	// 2. Matches with direct_chat_requested but chat_request is expired/declined
	const { data: requestedMatches } = await supabase
		.from("matches")
		.select("id")
		.eq("status", "direct_chat_requested");
	for (const m of requestedMatches ?? []) {
		const { data: cr } = await supabase
			.from("chat_requests")
			.select("id, status")
			.eq("match_id", m.id)
			.single();
		if (cr?.status === "expired") {
			await supabase.from("matches").update({ status: "chat_request_expired", updated_at: new Date().toISOString() }).eq("id", m.id);
			fixes.push(`Match ${m.id}: direct_chat_requested with expired chat_request -> chat_request_expired`);
		} else if (cr?.status === "declined") {
			await supabase.from("matches").update({ status: "chat_request_declined", updated_at: new Date().toISOString() }).eq("id", m.id);
			fixes.push(`Match ${m.id}: direct_chat_requested with declined chat_request -> chat_request_declined`);
		}
	}

	// 3. Matches with pending but fox_conversation is failed
	const { data: pendingMatches } = await supabase
		.from("matches")
		.select("id")
		.eq("status", "pending");
	for (const m of pendingMatches ?? []) {
		const { data: fc } = await supabase
			.from("fox_conversations")
			.select("id, status")
			.eq("match_id", m.id)
			.single();
		if (fc?.status === "failed") {
			await supabase.from("matches").update({ status: "fox_conversation_failed", updated_at: new Date().toISOString() }).eq("id", m.id);
			fixes.push(`Match ${m.id}: pending with failed fox_conversation -> fox_conversation_failed`);
		}
	}

	// 4. Fox conversations stuck in_progress (started_at older than threshold)
	const stuckCutoff = new Date(Date.now() - STUCK_IN_PROGRESS_MINUTES * 60 * 1000).toISOString();
	const { data: stuckConvs } = await supabase
		.from("fox_conversations")
		.select("id, match_id")
		.eq("status", "in_progress")
		.lt("started_at", stuckCutoff);
	for (const conv of stuckConvs ?? []) {
		await supabase
			.from("fox_conversations")
			.update({ status: "failed" })
			.eq("id", conv.id);
		await supabase
			.from("matches")
			.update({ status: "fox_conversation_failed", updated_at: new Date().toISOString() })
			.eq("id", conv.match_id);
		fixes.push(`Fox conversation ${conv.id} (match ${conv.match_id}): in_progress > ${STUCK_IN_PROGRESS_MINUTES}min -> failed`);
	}

	return jsonData(c, { message: "Integrity check completed", fixes_applied: fixes.length, fixes });
});

export default internal;
