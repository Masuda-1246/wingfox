/**
 * Daily Matching Service
 *
 * 日次バッチマッチング: 公平分配アルゴリズムで各ユーザーに最大1マッチを割り当て。
 * 候補がなければマッチなし（全員保証なし）。
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../db/types";
import {
	computeMatchScore,
	isOppositeOrCompatibleGender,
} from "./matching";
import { saveFeatureScores } from "./compatibility";

const DAILY_BATCH_TOTAL_ROUNDS = 5;

interface ScoredPair {
	userA: string;
	userB: string;
	score: number;
	profileScore: number;
	details: Record<string, number>;
	layerScores: {
		layer1: number;
		layer2: number;
		layer3: number;
		featureScores: Record<number, number>;
	};
	featureScores: import("./compatibility").FeatureScore[];
}

interface DailyMatchingResult {
	totalUsers: number;
	usersMatched: number;
	totalMatches: number;
	matchIds: string[];
}

/**
 * 公平分配アルゴリズム
 *
 * スコア降順にペアをソートし、各ユーザーが maxPerUser を超えないよう greedy 割り当て。
 * 双方のカウントを追跡するため、マッチ時に +1 ずつカウントされる。
 */
function allocateMatches(
	scoredPairs: ScoredPair[],
	maxPerUser: number,
): ScoredPair[] {
	const sorted = [...scoredPairs].sort((a, b) => b.score - a.score);
	const matchCountMap = new Map<string, number>();
	const selected: ScoredPair[] = [];

	for (const pair of sorted) {
		const countA = matchCountMap.get(pair.userA) ?? 0;
		const countB = matchCountMap.get(pair.userB) ?? 0;
		if (countA >= maxPerUser || countB >= maxPerUser) continue;

		selected.push(pair);
		matchCountMap.set(pair.userA, countA + 1);
		matchCountMap.set(pair.userB, countB + 1);
	}

	return selected;
}

/**
 * 日次マッチングを実行
 *
 * 1. confirmed ユーザーを取得
 * 2. 性別取得
 * 3. ブロック関係・既存マッチを除外
 * 4. 全異性ペアのスコアを計算
 * 5. dealbreaker ペアを除外
 * 6. 公平分配アルゴリズムで割り当て
 * 7. matches + daily_match_pairs + fox_conversations を作成
 */
export async function executeDailyMatching(
	supabase: SupabaseClient<Database>,
	matchDate: string,
	maxPerUser = 1,
): Promise<DailyMatchingResult> {
	// 1. confirmed ユーザーのプロフィール取得
	const { data: profiles } = await supabase
		.from("profiles")
		.select("*")
		.eq("status", "confirmed");
	if (!profiles?.length) {
		return { totalUsers: 0, usersMatched: 0, totalMatches: 0, matchIds: [] };
	}

	const totalUsers = profiles.length;

	// 2. user_profiles から gender を取得
	const userIds = [...new Set(profiles.map((p) => p.user_id))];
	const { data: userProfiles } = await supabase
		.from("user_profiles")
		.select("id, gender")
		.in("id", userIds);
	const genderByUserId = new Map<string, string | null>(
		(userProfiles ?? []).map((u) => [u.id, u.gender]),
	);

	// 3. ブロック関係・既存マッチを除外セットに
	const { data: blocks } = await supabase
		.from("blocks")
		.select("blocker_id, blocked_id");
	const blockSet = new Set(
		(blocks ?? []).map((b) => `${b.blocker_id}:${b.blocked_id}`),
	);
	const isBlocked = (a: string, b: string) =>
		blockSet.has(`${a}:${b}`) || blockSet.has(`${b}:${a}`);

	const { data: existing } = await supabase
		.from("matches")
		.select("user_a_id, user_b_id");
	const existingSet = new Set(
		(existing ?? []).map((m) =>
			m.user_a_id < m.user_b_id
				? `${m.user_a_id}:${m.user_b_id}`
				: `${m.user_b_id}:${m.user_a_id}`,
		),
	);

	// 4. 全異性ペアのスコアを計算
	const scoredPairs: ScoredPair[] = [];
	for (let i = 0; i < profiles.length; i++) {
		for (let j = i + 1; j < profiles.length; j++) {
			const idA = profiles[i].user_id;
			const idB = profiles[j].user_id;
			if (idA === idB || isBlocked(idA, idB)) continue;

			if (
				!isOppositeOrCompatibleGender(
					genderByUserId.get(idA) ?? null,
					genderByUserId.get(idB) ?? null,
				)
			)
				continue;

			const key =
				idA < idB ? `${idA}:${idB}` : `${idB}:${idA}`;
			if (existingSet.has(key)) continue;

			const result = computeMatchScore(profiles[i], profiles[j]);

			// 5. dealbreaker ペアを除外
			if (result.dealbreakers.triggered) continue;

			scoredPairs.push({
				userA: idA,
				userB: idB,
				score: result.score,
				profileScore: result.score,
				details: result.details,
				layerScores: result.layerScores,
				featureScores: result.featureScores,
			});
		}
	}

	// 6. 公平分配アルゴリズムで割り当て
	const allocated = allocateMatches(scoredPairs, maxPerUser);
	if (allocated.length === 0) {
		return { totalUsers, usersMatched: 0, totalMatches: 0, matchIds: [] };
	}

	// 7. matches + fox_conversations を一括作成
	const toInsert = allocated.map((pair) => {
		const aId = pair.userA < pair.userB ? pair.userA : pair.userB;
		const bId = pair.userA < pair.userB ? pair.userB : pair.userA;
		return {
			user_a_id: aId,
			user_b_id: bId,
			profile_score: pair.profileScore,
			final_score: null as number | null,
			score_details: pair.details as Json,
			layer_scores: {
				layer1: pair.layerScores.layer1,
				layer2: pair.layerScores.layer2,
				layer3: pair.layerScores.layer3,
				feature_scores: pair.layerScores.featureScores,
			} as Json,
		};
	});

	const { data: inserted } = await supabase
		.from("matches")
		.insert(toInsert)
		.select("id");
	if (!inserted?.length) {
		return { totalUsers, usersMatched: 0, totalMatches: 0, matchIds: [] };
	}

	// feature scores + fox_conversations を各マッチに作成
	const matchIds: string[] = [];
	for (let i = 0; i < inserted.length; i++) {
		const matchId = inserted[i].id;
		matchIds.push(matchId);

		await saveFeatureScores(supabase, matchId, allocated[i].featureScores);

		const { error: pairError } = await supabase.from("daily_match_pairs").insert({
			match_id: matchId,
			match_date: matchDate,
		});
		if (pairError) {
			console.error(
				`[executeDailyMatching] Failed to create daily_match_pair for match ${matchId}:`,
				pairError,
			);
			await supabase.from("matches").delete().eq("id", matchId);
			matchIds.pop();
			continue;
		}

		const { error: fcError } = await supabase
			.from("fox_conversations")
			.insert({
				match_id: matchId,
				status: "pending",
				total_rounds: DAILY_BATCH_TOTAL_ROUNDS,
			});
		if (fcError) {
			console.error(
				`[executeDailyMatching] Failed to create fox_conversation for match ${matchId}:`,
				fcError,
			);
			await supabase.from("matches").delete().eq("id", matchId);
			matchIds.pop();
		}
	}

	// マッチされたユニークユーザー数をカウント
	const matchedUsers = new Set<string>();
	for (const pair of allocated) {
		matchedUsers.add(pair.userA);
		matchedUsers.add(pair.userB);
	}

	return {
		totalUsers,
		usersMatched: matchedUsers.size,
		totalMatches: matchIds.length,
		matchIds,
	};
}
