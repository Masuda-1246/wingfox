import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../db/types";
import { getProfileScoreDetailsForUsers, isOppositeOrCompatibleGender } from "./matching";

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

	// 異性のみ候補にする: 自分の性別と候補の性別を取得
	const { data: myProfile } = await supabase
		.from("user_profiles")
		.select("gender")
		.eq("id", userId)
		.single();
	const candidateIds = [...new Set((candidates ?? []).map((c) => c.user_id))];
	const { data: candidateProfiles } = candidateIds.length
		? await supabase.from("user_profiles").select("id, gender").in("id", candidateIds)
		: { data: [] };
	const genderByCandidateId = new Map(
		(candidateProfiles ?? []).map((p) => [p.id, p.gender]),
	);
	const myGender = myProfile?.gender ?? null;

	const eligible = (candidates ?? []).filter(
		(c) =>
			!matchedUserIds.has(c.user_id) &&
			!blockedIds.has(c.user_id) &&
			isOppositeOrCompatibleGender(myGender, genderByCandidateId.get(c.user_id) ?? null),
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

	const scoreDetails = await getProfileScoreDetailsForUsers(supabase, userA, userB);
	const matchPayload: {
		user_a_id: string;
		user_b_id: string;
		status: string;
		profile_score?: number;
		final_score?: number;
		score_details?: Record<string, number>;
	} = {
		user_a_id: userA,
		user_b_id: userB,
		status: "fox_conversation_in_progress",
	};
	if (scoreDetails) {
		matchPayload.profile_score = scoreDetails.profile_score;
		matchPayload.final_score = scoreDetails.final_score;
		matchPayload.score_details = scoreDetails.score_details;
	}

	const { data: match, error: matchError } = await supabase
		.from("matches")
		.insert(matchPayload)
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
			total_rounds: 5,
			current_round: 0,
		})
		.select("id")
		.single();
	if (fcError || !foxConv) {
		// Compensate: delete the match we just created
		await supabase.from("matches").delete().eq("id", match.id);
		throw new Error("FOX_CONVERSATION_CREATE_FAILED");
	}

	return {
		match_id: match.id,
		fox_conversation_id: foxConv.id,
		partner_user_id: partnerUserId,
	};
}

const MAX_MULTIPLE_MATCHES = 3;

export async function searchAndStartMultipleFoxConversations(
	supabase: SupabaseClient<Database>,
	userId: string,
): Promise<Array<{ match_id: string; fox_conversation_id: string; partner_user_id: string }>> {
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

	// 異性のみ候補にする: 自分の性別と候補の性別を取得
	const { data: myProfileMulti } = await supabase
		.from("user_profiles")
		.select("gender")
		.eq("id", userId)
		.single();
	const candidateIdsForGender = [...new Set((candidates ?? []).map((c) => c.user_id))];
	const { data: candidateProfilesForGender } = candidateIdsForGender.length
		? await supabase.from("user_profiles").select("id, gender").in("id", candidateIdsForGender)
		: { data: [] };
	const genderByCandidateIdMulti = new Map(
		(candidateProfilesForGender ?? []).map((p) => [p.id, p.gender]),
	);
	const myGenderMulti = myProfileMulti?.gender ?? null;

	const eligible = (candidates ?? []).filter(
		(c) =>
			!matchedUserIds.has(c.user_id) &&
			!blockedIds.has(c.user_id) &&
			isOppositeOrCompatibleGender(myGenderMulti, genderByCandidateIdMulti.get(c.user_id) ?? null),
	);
	if (eligible.length === 0) {
		throw new Error("NO_CANDIDATES_FOUND");
	}

	// 5. Fisher-Yates shuffle and pick up to MAX_MULTIPLE_MATCHES
	for (let i = eligible.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[eligible[i], eligible[j]] = [eligible[j], eligible[i]];
	}
	const picks = eligible.slice(0, MAX_MULTIPLE_MATCHES);

	// 6-7. Create match + fox_conversation for each pick (individual failures are skipped)
	const results: Array<{ match_id: string; fox_conversation_id: string; partner_user_id: string }> = [];

	for (const pick of picks) {
		try {
			const partnerUserId = pick.user_id;
			const [userA, userB] =
				userId < partnerUserId ? [userId, partnerUserId] : [partnerUserId, userId];

			const scoreDetails = await getProfileScoreDetailsForUsers(supabase, userA, userB);
			const matchPayload: {
				user_a_id: string;
				user_b_id: string;
				status: string;
				profile_score?: number;
				final_score?: number;
				score_details?: Record<string, number>;
			} = {
				user_a_id: userA,
				user_b_id: userB,
				status: "fox_conversation_in_progress",
			};
			if (scoreDetails) {
				matchPayload.profile_score = scoreDetails.profile_score;
				matchPayload.final_score = scoreDetails.final_score;
				matchPayload.score_details = scoreDetails.score_details;
			}

			const { data: match, error: matchError } = await supabase
				.from("matches")
				.insert(matchPayload)
				.select("id")
				.single();
			if (matchError || !match) continue;

			const { data: foxConv, error: fcError } = await supabase
				.from("fox_conversations")
				.insert({
					match_id: match.id,
					status: "pending",
					total_rounds: 5,
					current_round: 0,
				})
				.select("id")
				.single();
			if (fcError || !foxConv) {
				// Compensate: delete the match we just created
				await supabase.from("matches").delete().eq("id", match.id);
				continue;
			}

			results.push({
				match_id: match.id,
				fox_conversation_id: foxConv.id,
				partner_user_id: partnerUserId,
			});
		} catch {
			// Skip individual failures
		}
	}

	if (results.length === 0) {
		throw new Error("ALL_MATCHES_FAILED");
	}

	return results;
}
