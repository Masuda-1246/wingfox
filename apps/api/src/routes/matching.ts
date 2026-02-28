import { Hono } from "hono";
import type { Env } from "../env";
import { getSupabaseClient } from "../db/client";
import { requireAuth } from "../middleware/auth";
import { jsonData, jsonError } from "../lib/response";
import { parseLimit, parseCursor } from "../lib/pagination";

const matching = new Hono<Env>();

/** in_progress のマッチで、created_at からこの分数を超えていたら stuck とみなし failed に落とす */
const STUCK_MATCH_MINUTES = 3;

/** GET /api/matching/results */
matching.get("/results", requireAuth, async (c) => {
	const userId = c.get("user_id");
	const limit = parseLimit(c.req.query("limit"));
	const cursor = parseCursor(c.req.query("cursor"));
	const statusFilter = c.req.query("status");
	const supabase = getSupabaseClient(c.env);

	// Fetch blocked user IDs (both directions)
	const [{ data: blockedByMe }, { data: blockedMe }] = await Promise.all([
		supabase.from("blocks").select("blocked_id").eq("blocker_id", userId),
		supabase.from("blocks").select("blocker_id").eq("blocked_id", userId),
	]);
	const blockedIds = new Set([
		...(blockedByMe ?? []).map((b) => b.blocked_id),
		...(blockedMe ?? []).map((b) => b.blocker_id),
	]);

	let q = supabase
		.from("matches")
		.select("id, user_a_id, user_b_id, final_score, profile_score, conversation_score, status, created_at")
		.or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
		.order("final_score", { ascending: false, nullsFirst: false });
	if (statusFilter) {
		const statuses = statusFilter.split(",");
		q = statuses.length === 1 ? q.eq("status", statuses[0]) : q.in("status", statuses);
	}
	if (cursor) q = q.lt("created_at", cursor);
	const { data: rows, error } = await q.limit(limit + 1);
	if (error) return jsonError(c, "INTERNAL_ERROR", "Failed to fetch matches");

	const partnerId = (m: { user_a_id: string; user_b_id: string }) => (m.user_a_id === userId ? m.user_b_id : m.user_a_id);

	// Filter out blocked users
	const filtered = (rows ?? []).filter((m) => !blockedIds.has(partnerId(m as { user_a_id: string; user_b_id: string })));
	const list = filtered.slice(0, limit);
	const next = list.length > limit ? list[list.length - 1]?.created_at : null;

	const partnerIds = list.map((m) => partnerId(m as { user_a_id: string; user_b_id: string }));
	const { data: profiles } = await supabase.from("user_profiles").select("id, nickname, avatar_url").in("id", partnerIds);
	const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
	// Partner wingfox persona icons (for chat list avatar)
	const { data: partnerPersonas } = await supabase
		.from("personas")
		.select("user_id, icon_url")
		.eq("persona_type", "wingfox")
		.in("user_id", partnerIds);
	const personaIconMap = new Map((partnerPersonas ?? []).map((p) => [p.user_id, p.icon_url]));
	const matchIds = list.map((x) => x.id);
	const { data: foxConvs } = await supabase
		.from("fox_conversations")
		.select("id, match_id, status")
		.in("match_id", matchIds);
	const fcMap = new Map(
		(foxConvs ?? []).map((f) => [f.match_id, { id: f.id, status: f.status }]),
	);

	// バックエンドで完了/失敗しているのに matches が in_progress のままのものを同期する（DO が match を更新し損ねた場合の自己修復）
	const resolvedStatus = new Map<string, string>();
	const stuckCutoff = new Date(Date.now() - STUCK_MATCH_MINUTES * 60 * 1000).toISOString();
	for (const m of list) {
		if (m.status !== "fox_conversation_in_progress") continue;
		const fc = fcMap.get(m.id);
		if (fc?.status === "completed") {
			await supabase
				.from("matches")
				.update({ status: "fox_conversation_completed", updated_at: new Date().toISOString() })
				.eq("id", m.id);
			resolvedStatus.set(m.id, "fox_conversation_completed");
		} else if (fc?.status === "failed") {
			await supabase
				.from("matches")
				.update({ status: "fox_conversation_failed", updated_at: new Date().toISOString() })
				.eq("id", m.id);
			resolvedStatus.set(m.id, "fox_conversation_failed");
		} else if (m.created_at < stuckCutoff) {
			// created_at から STUCK_MATCH_MINUTES 分を超えていたら stuck とみなす
			await supabase.from("fox_conversations").update({ status: "failed" }).eq("match_id", m.id);
			await supabase
				.from("matches")
				.update({ status: "fox_conversation_failed", updated_at: new Date().toISOString() })
				.eq("id", m.id);
			resolvedStatus.set(m.id, "fox_conversation_failed");
		}
	}

	const results = list.map((m) => {
		const pid = partnerId(m as { user_a_id: string; user_b_id: string });
		const partner = profileMap.get(pid);
		const status = resolvedStatus.get(m.id) ?? m.status;
		return {
			id: m.id,
			partner_id: pid,
			partner: partner ? {
				nickname: partner.nickname,
				avatar_url: partner.avatar_url,
				persona_icon_url: personaIconMap.get(pid) ?? null,
			} : null,
			final_score: m.final_score,
			profile_score: m.profile_score,
			conversation_score: m.conversation_score,
			common_tags: [] as string[],
			status,
			fox_conversation_status: fcMap.get(m.id)?.status ?? null,
			fox_conversation_id: fcMap.get(m.id)?.id ?? null,
			created_at: m.created_at,
		};
	});
	return c.json({
		data: results,
		next_cursor: next ?? null,
		has_more: (rows?.length ?? 0) > limit,
	});
});

/** GET /api/matching/results/:id */
matching.get("/results/:id", requireAuth, async (c) => {
	const userId = c.get("user_id");
	const id = c.req.param("id");
	const supabase = getSupabaseClient(c.env);
	const { data: match, error } = await supabase
		.from("matches")
		.select("*")
		.eq("id", id)
		.or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
		.single();
	if (error || !match) return jsonError(c, "NOT_FOUND", "Match not found");
	const partnerId = match.user_a_id === userId ? match.user_b_id : match.user_a_id;

	// Check if partner is blocked (either direction)
	const { data: blockRow } = await supabase
		.from("blocks")
		.select("id")
		.or(`and(blocker_id.eq.${userId},blocked_id.eq.${partnerId}),and(blocker_id.eq.${partnerId},blocked_id.eq.${userId})`)
		.limit(1)
		.maybeSingle();
	if (blockRow) return jsonError(c, "NOT_FOUND", "Match not found");

	const { data: partner } = await supabase.from("user_profiles").select("nickname, avatar_url").eq("id", partnerId).single();
	const { data: partnerPersona } = await supabase
		.from("personas")
		.select("icon_url")
		.eq("user_id", partnerId)
		.eq("persona_type", "wingfox")
		.maybeSingle();
	const { data: fc } = await supabase
		.from("fox_conversations")
		.select("id, status")
		.eq("match_id", id)
		.single();

	// 一覧と同様: in_progress のままになっている場合は fc の状態に合わせて同期。matches.created_at から3分超なら stuck とみなす
	let status = match.status;
	let matchData = match;
	if (match.status === "fox_conversation_in_progress" && fc) {
		const stuckCutoff = new Date(Date.now() - STUCK_MATCH_MINUTES * 60 * 1000).toISOString();
		if (fc.status === "completed") {
			await supabase
				.from("matches")
				.update({ status: "fox_conversation_completed", updated_at: new Date().toISOString() })
				.eq("id", id);
			status = "fox_conversation_completed";
		} else if (fc.status === "failed") {
			await supabase
				.from("matches")
				.update({ status: "fox_conversation_failed", updated_at: new Date().toISOString() })
				.eq("id", id);
			status = "fox_conversation_failed";
		} else if (match.created_at < stuckCutoff) {
			await supabase.from("fox_conversations").update({ status: "failed" }).eq("match_id", id);
			await supabase
				.from("matches")
				.update({ status: "fox_conversation_failed", updated_at: new Date().toISOString() })
				.eq("id", id);
			status = "fox_conversation_failed";
		}
		// 更新した場合は match を再取得してスコア等を返す（completed で DO が既に書いていればその値が入る）
		if (status !== match.status) {
			const { data: updated } = await supabase
				.from("matches")
				.select("*")
				.eq("id", id)
				.single();
			if (updated) matchData = updated;
		}
	}

	const { data: pfc } = await supabase.from("partner_fox_chats").select("id").eq("match_id", id).eq("user_id", userId).single();
	const { data: cr } = await supabase.from("chat_requests").select("status").eq("match_id", id).single();
	const { data: room } = await supabase.from("direct_chat_rooms").select("id").eq("match_id", id).single();

	return jsonData(c, {
		id: matchData.id,
		partner_id: partnerId,
		partner: partner ? {
			nickname: partner.nickname,
			avatar_url: partner.avatar_url,
			persona_icon_url: partnerPersona?.icon_url ?? null,
		} : null,
		profile_score: matchData.profile_score,
		conversation_score: matchData.conversation_score,
		final_score: matchData.final_score,
		score_details: matchData.score_details,
		layer_scores: matchData.layer_scores,
		fox_summary: (matchData.score_details as Record<string, string>)?.summary ?? "",
		status,
		fox_conversation_id: fc?.id ?? null,
		partner_fox_chat_id: pfc?.id ?? null,
		chat_request_status: cr?.status ?? null,
		direct_chat_room_id: room?.id ?? null,
	});
});

export default matching;
