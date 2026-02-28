import type { Context, Next } from "hono";
import type { Env } from "../env";
import type { Database } from "../db/types";
import { getSupabaseAuthClient } from "../db/client";
import { getSupabaseClient } from "../db/client";
import { jsonError } from "../lib/response";

// Cache auth results for 30 seconds to avoid repeated Supabase calls
const authCache = new Map<string, { authUserId: string; userId: string; expiresAt: number }>();
const AUTH_CACHE_TTL = 5 * 60_000;

export async function requireAuth(c: Context<Env>, next: Next) {
	const startedAt = Date.now();
	const authHeader = c.req.header("Authorization");
	if (!authHeader?.startsWith("Bearer ")) {
		return jsonError(c, "UNAUTHORIZED", "Missing or invalid Authorization header");
	}
	const token = authHeader.slice(7);

	// Check cache first
	const cached = authCache.get(token);
	if (cached && cached.expiresAt > Date.now()) {
		c.set("auth_user_id", cached.authUserId);
		c.set("user_id", cached.userId);
		const totalMs = Date.now() - startedAt;
		if (totalMs > 100) {
			console.warn(`[auth] slow cache hit ${totalMs}ms`);
		}
		await next();
		return;
	}

	const supabase = getSupabaseAuthClient(c.env);
	const getUserStartedAt = Date.now();
	const {
		data: { user },
		error,
	} = await supabase.auth.getUser(token);
	const getUserMs = Date.now() - getUserStartedAt;
	if (error || !user) {
		authCache.delete(token);
		return jsonError(c, "UNAUTHORIZED", "Invalid or expired token");
	}
	const admin = getSupabaseClient(c.env);
	const profileLookupStartedAt = Date.now();
	const { data: existing } = await admin
		.from("user_profiles")
		.select("id")
		.eq("auth_user_id", user.id)
		.single();
	const profileLookupMs = Date.now() - profileLookupStartedAt;
	let profile: { id: string } | null = existing ?? null;
	if (!profile) {
		const email = user.email ?? "";
		const nickname = email.includes("@") ? email.slice(0, email.indexOf("@")) : email || "User";
		const insertRow: Database["public"]["Tables"]["user_profiles"]["Insert"] = {
			auth_user_id: user.id,
			nickname: nickname || "User",
		};
		const { data: inserted, error: upsertError } = await admin
			.from("user_profiles")
			.upsert(insertRow as never, { onConflict: "auth_user_id" })
			.select("id")
			.single();
		if (upsertError) {
			return jsonError(
				c,
				"INTERNAL_ERROR",
				`Failed to create user profile: ${upsertError.message}`,
			);
		}
		profile = inserted as { id: string } | null;
	}
	if (!profile) {
		return jsonError(c, "UNAUTHORIZED", "User profile not found");
	}

	// Cache the result
	authCache.set(token, {
		authUserId: user.id,
		userId: profile.id,
		expiresAt: Date.now() + AUTH_CACHE_TTL,
	});

	c.set("auth_user_id", user.id);
	c.set("user_id", profile.id);
	const totalMs = Date.now() - startedAt;
	if (totalMs > 300) {
		console.warn(
			`[auth] slow auth ${totalMs}ms (get_user=${getUserMs}ms, profile_lookup=${profileLookupMs}ms, cache=miss)`,
		);
	}
	await next();
}
