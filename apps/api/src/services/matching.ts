import type { Database, Json } from "../db/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
	computeProfileFeatureScores,
	calculateLayerScores,
	detectDealbreakers,
	saveFeatureScores,
	type FeatureScore,
	type LayerScores,
	type DealbreakerResult,
} from "./compatibility";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

// ─── Legacy 5-axis scoring (kept for backward compat in score_details) ──

function getPersonalityScore(a: ProfileRow, b: ProfileRow): number {
	const pa = (a.personality_analysis as Record<string, number>) ?? {};
	const pb = (b.personality_analysis as Record<string, number>) ?? {};
	let sum = 0;
	let n = 0;
	for (const key of ["introvert_extrovert", "planned_spontaneous", "logical_emotional"]) {
		const va = pa[key];
		const vb = pb[key];
		if (typeof va === "number" && typeof vb === "number") {
			sum += 1 - Math.abs(va - vb);
			n++;
		}
	}
	const tagsA = (a.personality_tags as string[]) ?? [];
	const tagsB = (b.personality_tags as string[]) ?? [];
	const tagOverlap = tagsA.length && tagsB.length ? tagsA.filter((t) => tagsB.includes(t)).length / Math.max(tagsA.length, tagsB.length) : 0.5;
	return n ? (sum / n) * 0.7 + tagOverlap * 0.3 : 0.5;
}

function getInterestsScore(a: ProfileRow, b: ProfileRow): number {
	const ia = (a.interests as { category: string; items: string[] }[]) ?? [];
	const ib = (b.interests as { category: string; items: string[] }[]) ?? [];
	const allItemsA = new Set(ia.flatMap((x) => x.items ?? []));
	const allItemsB = new Set(ib.flatMap((x) => x.items ?? []));
	if (allItemsA.size === 0 && allItemsB.size === 0) return 0.5;
	const overlap = [...allItemsA].filter((x) => allItemsB.has(x)).length;
	const union = new Set([...allItemsA, ...allItemsB]).size;
	return union ? overlap / union : 0.5;
}

function getValuesScore(a: ProfileRow, b: ProfileRow): number {
	const va = (a.values as Record<string, number>) ?? {};
	const vb = (b.values as Record<string, number>) ?? {};
	const keys = new Set([...Object.keys(va), ...Object.keys(vb)]);
	if (keys.size === 0) return 0.5;
	let sum = 0;
	for (const k of keys) {
		const aVal = va[k];
		const bVal = vb[k];
		if (typeof aVal === "number" && typeof bVal === "number") {
			sum += 1 - Math.abs(aVal - bVal);
		}
	}
	return keys.size ? sum / keys.size : 0.5;
}

function getCommunicationScore(a: ProfileRow, b: ProfileRow): number {
	const ca = (a.communication_style as Record<string, unknown>) ?? {};
	const cb = (b.communication_style as Record<string, unknown>) ?? {};
	const lenA = ca.message_length;
	const lenB = cb.message_length;
	if (lenA === lenB) return 1;
	return 0.7;
}

// ─── 14-feature based matching ─────────────────────────────────────────

interface MatchResult {
	score: number; // 0-100
	details: Record<string, number>; // legacy 5-axis + layer scores (0-100 each)
	layerScores: LayerScores;
	featureScores: FeatureScore[];
	dealbreakers: DealbreakerResult;
}

export function computeMatchScore(
	profileA: ProfileRow,
	profileB: ProfileRow,
): MatchResult {
	// 1. Compute 14 feature scores from profiles
	const featureScores = computeProfileFeatureScores(profileA, profileB);

	// 2. Build feature map for layer calculation
	const featureMap = new Map<number, number>();
	for (const fs of featureScores) {
		featureMap.set(fs.featureId, fs.normalizedScore);
	}

	// 3. Calculate 3-layer scores (20% / 50% / 30%)
	const layerScores = calculateLayerScores(featureMap);

	// 4. Detect dealbreakers
	const dealbreakers = detectDealbreakers(featureMap);

	// 5. Legacy 5-axis scores for backward compatibility
	const personality = getPersonalityScore(profileA, profileB);
	const interests = getInterestsScore(profileA, profileB);
	const values = getValuesScore(profileA, profileB);
	const communication = getCommunicationScore(profileA, profileB);

	const details: Record<string, number> = {
		personality: Math.round(personality * 100),
		interests: Math.round(interests * 100),
		values: Math.round(values * 100),
		communication: Math.round(communication * 100),
		layer1: Math.round(layerScores.layer1 * 100),
		layer2: Math.round(layerScores.layer2 * 100),
		layer3: Math.round(layerScores.layer3 * 100),
	};

	return {
		score: dealbreakers.triggered ? 0 : layerScores.finalScore,
		details,
		layerScores,
		featureScores,
		dealbreakers,
	};
}

export async function executeMatching(supabase: SupabaseClient<Database>, topN: number = 10): Promise<number> {
	const { data: profiles } = await supabase.from("profiles").select("*").eq("status", "confirmed");
	if (!profiles?.length) return 0;
	const { data: blocks } = await supabase.from("blocks").select("blocker_id, blocked_id");
	const blockSet = new Set((blocks ?? []).map((b) => `${b.blocker_id}:${b.blocked_id}`));
	const isBlocked = (a: string, b: string) => blockSet.has(`${a}:${b}`) || blockSet.has(`${b}:${a}`);
	const { data: existing } = await supabase.from("matches").select("user_a_id, user_b_id");
	const existingSet = new Set(
		(existing ?? []).map((m) => (m.user_a_id < m.user_b_id ? `${m.user_a_id}:${m.user_b_id}` : `${m.user_b_id}:${m.user_a_id}`)),
	);

	const scored: { userA: string; userB: string; result: MatchResult }[] = [];
	for (let i = 0; i < profiles.length; i++) {
		for (let j = i + 1; j < profiles.length; j++) {
			const idA = profiles[i].user_id;
			const idB = profiles[j].user_id;
			if (idA === idB || isBlocked(idA, idB)) continue;
			const key = idA < idB ? `${idA}:${idB}` : `${idB}:${idA}`;
			if (existingSet.has(key)) continue;
			const result = computeMatchScore(profiles[i], profiles[j]);
			// Skip dealbreaker-triggered pairs
			if (result.dealbreakers.triggered) continue;
			scored.push({ userA: idA, userB: idB, result });
		}
	}
	scored.sort((a, b) => b.result.score - a.result.score);

	const perUser = new Map<string, number>();
	const toInsert: {
		user_a_id: string;
		user_b_id: string;
		profile_score: number;
		final_score: number;
		score_details: Json;
		layer_scores: Json;
	}[] = [];
	const matchFeatureScores: FeatureScore[][] = [];

	for (const s of scored) {
		const countA = perUser.get(s.userA) ?? 0;
		const countB = perUser.get(s.userB) ?? 0;
		if (countA >= topN || countB >= topN) continue;
		const aId = s.userA < s.userB ? s.userA : s.userB;
		const bId = s.userA < s.userB ? s.userB : s.userA;
		toInsert.push({
			user_a_id: aId,
			user_b_id: bId,
			profile_score: s.result.score,
			final_score: s.result.score,
			score_details: s.result.details as Json,
			layer_scores: {
				layer1: s.result.layerScores.layer1,
				layer2: s.result.layerScores.layer2,
				layer3: s.result.layerScores.layer3,
				feature_scores: s.result.layerScores.featureScores,
			} as Json,
		});
		matchFeatureScores.push(s.result.featureScores);
		perUser.set(s.userA, countA + 1);
		perUser.set(s.userB, countB + 1);
	}
	if (toInsert.length === 0) return 0;

	const { data: inserted } = await supabase.from("matches").insert(toInsert).select("id");
	if (!inserted?.length) return 0;

	for (let i = 0; i < inserted.length; i++) {
		const matchId = inserted[i].id;
		await saveFeatureScores(supabase, matchId, matchFeatureScores[i]);
		const { error: fcError } = await supabase.from("fox_conversations").insert({ match_id: matchId, status: "pending" });
		if (fcError) {
			await supabase.from("matches").delete().eq("id", matchId);
		}
	}

	return inserted.length;
}

const TRAIT_KEYS = ["personality", "interests", "values", "communication"] as const;

/** score_details に特性軸が含まれているか */
export function hasTraitScores(details: Record<string, unknown>): boolean {
	return TRAIT_KEYS.every((k) => typeof details[k] === "number");
}

/** score_details に14特徴量のレイヤースコアが含まれているか */
export function hasLayerScores(details: Record<string, unknown>): boolean {
	return typeof details.layer1 === "number" && typeof details.layer2 === "number" && typeof details.layer3 === "number";
}

/** 2ユーザーの profiles から互換性スコアを計算。どちらかが無い場合は null */
export async function getProfileScoreDetailsForUsers(
	supabase: SupabaseClient<Database>,
	userA: string,
	userB: string,
): Promise<{ profile_score: number; final_score: number; score_details: Record<string, number>; layerScores: LayerScores; featureScores: FeatureScore[] } | null> {
	const { data: profiles } = await supabase
		.from("profiles")
		.select("*")
		.in("user_id", [userA, userB])
		.eq("status", "confirmed");
	if (!profiles || profiles.length !== 2) return null;
	const byUserId = new Map(profiles.map((p) => [p.user_id, p as ProfileRow]));
	const profileA = byUserId.get(userA);
	const profileB = byUserId.get(userB);
	if (!profileA || !profileB) return null;
	const result = computeMatchScore(profileA, profileB);
	return {
		profile_score: result.score,
		final_score: result.score,
		score_details: result.details,
		layerScores: result.layerScores,
		featureScores: result.featureScores,
	};
}
