import { Hono } from "hono";
import type { Env } from "../env";
import { getSupabaseClient } from "../db/client";
import { jsonData, jsonError } from "../lib/response";
import { requireAuth } from "../middleware/auth";
import { z } from "zod";

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

/** GET /api/auth/me - current user profile including onboarding_status */
auth.get("/me", requireAuth, async (c) => {
	const userId = c.get("user_id");
	const supabase = getSupabaseClient(c.env);
	const { data, error } = await supabase
		.from("user_profiles")
		.select("id, nickname, gender, birth_year, onboarding_status, avatar_url, notification_seen_at")
		.eq("id", userId)
		.single();
	if (error || !data) {
		return jsonError(c, "NOT_FOUND", "User profile not found");
	}
	return jsonData(c, data);
});

const updateMeSchema = z.object({
	nickname: z.string().min(1).max(100).optional(),
	gender: z.enum(["male", "female", "other", "undisclosed"]).optional(),
	birth_year: z.number().int().min(1900).max(2100).nullable().optional(),
});

/** PUT /api/auth/me - update current user profile (nickname, gender, birth_year) */
auth.put("/me", requireAuth, async (c) => {
	const userId = c.get("user_id");
	const parsed = updateMeSchema.safeParse(await c.req.json());
	if (!parsed.success) {
		return jsonError(c, "BAD_REQUEST", parsed.error.message);
	}
	const supabase = getSupabaseClient(c.env);
	const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
	if (parsed.data.nickname !== undefined) updates.nickname = parsed.data.nickname;
	if (parsed.data.gender !== undefined) updates.gender = parsed.data.gender;
	if (parsed.data.birth_year !== undefined) updates.birth_year = parsed.data.birth_year;
	const { data, error } = await supabase
		.from("user_profiles")
		.update(updates)
		.eq("id", userId)
		.select("id, nickname, gender, birth_year, onboarding_status, avatar_url, notification_seen_at")
		.single();
	if (error) {
		return jsonError(c, "INTERNAL_ERROR", "Failed to update profile");
	}
	return jsonData(c, data);
});

/** POST /api/auth/me/notification-seen - mark notification dropdown as seen (updates notification_seen_at) */
auth.post("/me/notification-seen", requireAuth, async (c) => {
	const userId = c.get("user_id");
	const supabase = getSupabaseClient(c.env);
	const now = new Date().toISOString();
	const { data, error } = await supabase
		.from("user_profiles")
		.update({ notification_seen_at: now })
		.eq("id", userId)
		.select("id, notification_seen_at")
		.single();
	if (error) {
		return jsonError(c, "INTERNAL_ERROR", "Failed to update notification seen");
	}
	return jsonData(c, { notification_seen_at: data?.notification_seen_at ?? now });
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
