import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../db/types";

export async function searchAndStartFoxConversation(
	supabase: SupabaseClient<Database>,
	userId: string,
): Promise<{ match_id: string; fox_conversation_id: string; partner_user_id: string }> {
	// 1. Verify current user has a wingfox persona
	const { data: myPersona } = await supabase
		.from("personas")
		.select("id")
		.eq("user_id", userId)
		.eq("persona_type", "wingfox")
		.single();
	if (!myPersona) {
		throw new Error("WINGFOX_PERSONA_NOT_FOUND");
	}

	// 2. Get existing matched user IDs to exclude
	const { data: existingMatches } = await supabase
		.from("matches")
		.select("user_a_id, user_b_id")
		.or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`);
	const matchedUserIds = new Set(
		(existingMatches ?? []).map((m) =>
			m.user_a_id === userId ? m.user_b_id : m.user_a_id,
		),
	);

	// 3. Get blocked user IDs (both directions)
	const [{ data: blockedByMe }, { data: blockedMe }] = await Promise.all([
		supabase.from("blocks").select("blocked_id").eq("blocker_id", userId),
		supabase.from("blocks").select("blocker_id").eq("blocked_id", userId),
	]);
	const blockedIds = new Set([
		...(blockedByMe ?? []).map((b) => b.blocked_id),
		...(blockedMe ?? []).map((b) => b.blocker_id),
	]);

	// 4. Find other users with wingfox personas
	const { data: candidates } = await supabase
		.from("personas")
		.select("user_id")
		.eq("persona_type", "wingfox")
		.neq("user_id", userId);

	const eligible = (candidates ?? []).filter(
		(c) => !matchedUserIds.has(c.user_id) && !blockedIds.has(c.user_id),
	);
	if (eligible.length === 0) {
		throw new Error("NO_CANDIDATES_FOUND");
	}

	// 5. Pick one at random
	const pick = eligible[Math.floor(Math.random() * eligible.length)];
	const partnerUserId = pick.user_id;

	// 6. Create match record (user_a_id < user_b_id convention)
	const [userA, userB] =
		userId < partnerUserId ? [userId, partnerUserId] : [partnerUserId, userId];

	const { data: match, error: matchError } = await supabase
		.from("matches")
		.insert({
			user_a_id: userA,
			user_b_id: userB,
			status: "pending",
		})
		.select("id")
		.single();
	if (matchError || !match) {
		throw new Error("MATCH_CREATE_FAILED");
	}

	// 7. Create fox_conversation record
	const { data: foxConv, error: fcError } = await supabase
		.from("fox_conversations")
		.insert({
			match_id: match.id,
			status: "pending",
			total_rounds: 15,
			current_round: 0,
		})
		.select("id")
		.single();
	if (fcError || !foxConv) {
		throw new Error("FOX_CONVERSATION_CREATE_FAILED");
	}

	return {
		match_id: match.id,
		fox_conversation_id: foxConv.id,
		partner_user_id: partnerUserId,
	};
}
