import type { Context, Next } from "hono";
import type { Env } from "../env";
import { getSupabaseAuthClient } from "../db/client";
import { getSupabaseClient } from "../db/client";
import { jsonError } from "../lib/response";

export async function requireAuth(c: Context<Env>, next: Next) {
	const authHeader = c.req.header("Authorization");
	if (!authHeader?.startsWith("Bearer ")) {
		return jsonError(c, "UNAUTHORIZED", "Missing or invalid Authorization header");
	}
	const token = authHeader.slice(7);
	const supabase = getSupabaseAuthClient(c.env);
	const {
		data: { user },
		error,
	} = await supabase.auth.getUser(token);
	if (error || !user) {
		return jsonError(c, "UNAUTHORIZED", "Invalid or expired token");
	}
	const admin = getSupabaseClient(c.env);
	let { data: profile } = await admin
		.from("user_profiles")
		.select("id")
		.eq("auth_user_id", user.id)
		.single();
	if (!profile) {
		const email = user.email ?? "";
		const nickname = email.includes("@") ? email.slice(0, email.indexOf("@")) : email || "User";
		await admin
			.from("user_profiles")
			.upsert({ auth_user_id: user.id, nickname: nickname || "User" }, { onConflict: "auth_user_id" });
		const { data: inserted } = await admin
			.from("user_profiles")
			.select("id")
			.eq("auth_user_id", user.id)
			.single();
		profile = inserted ?? undefined;
	}
	if (!profile) {
		return jsonError(c, "UNAUTHORIZED", "User profile not found");
	}
	c.set("auth_user_id", user.id);
	c.set("user_id", profile.id);
	await next();
}
