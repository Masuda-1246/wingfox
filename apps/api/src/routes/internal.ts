import { Hono } from "hono";
import type { Env } from "../env";
import { getSupabaseClient } from "../db/client";
import { jsonData, jsonError } from "../lib/response";
import { executeMatching } from "../services/matching";
import { runFoxConversation } from "../services/fox-conversation";

const internal = new Hono<Env>();

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
		.select("id");
	return jsonData(c, { message: "Expired", count: data?.length ?? 0 });
});

export default internal;
