import { Hono } from "hono";
import type { Env } from "../env";
import { getSupabaseClient } from "../db/client";
import { jsonData, jsonError } from "../lib/response";
import { requireAuth } from "../middleware/auth";

const auth = new Hono<Env>();

/** Supabase Auth Webhook: create user_profiles on signup */
auth.post("/callback", async (c) => {
	const body = await c.req.json().catch(() => null) as {
		type?: string;
		table?: string;
		schema?: string;
		record?: { id?: string; email?: string };
	} | null;
	if (!body || body.schema !== "auth" || body.table !== "users" || body.type !== "INSERT") {
		return jsonError(c, "BAD_REQUEST", "Invalid webhook payload");
	}
	const record = body.record;
	if (!record?.id) {
		return jsonError(c, "BAD_REQUEST", "Missing user id");
	}
	const email = record.email ?? "";
	const nickname = email.includes("@") ? email.slice(0, email.indexOf("@")) : email || "User";
	const supabase = getSupabaseClient(c.env);
	const { error } = await supabase.from("user_profiles").insert({
		auth_user_id: record.id,
		nickname: nickname || "User",
	});
	if (error) {
		console.error("auth/callback insert error:", error);
		return jsonError(c, "INTERNAL_ERROR", "Failed to create user profile");
	}
	return c.json({ ok: true }, 200);
});

/** Delete account (requires auth) */
auth.delete("/account", requireAuth, async (c) => {
	const authUserId = c.get("auth_user_id");
	const supabase = getSupabaseClient(c.env);
	const { error } = await supabase.auth.admin.deleteUser(authUserId);
	if (error) {
		console.error("auth/account delete error:", error);
		return jsonError(c, "INTERNAL_ERROR", "Failed to delete account");
	}
	return jsonData(c, { message: "Account deleted" });
});

export default auth;
