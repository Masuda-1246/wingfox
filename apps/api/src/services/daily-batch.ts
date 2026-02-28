/**
 * Daily Batch Orchestration
 *
 * 日次バッチの全体フロー:
 *  1. daily_match_batches に insert（UNIQUE 制約で二重実行防止）
 *  2. executeDailyMatching() でマッチ作成
 *  3. fox_conversations を直列実行（レート制限対応）
 *  4. バッチ完了/失敗を記録
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../db/types";
import { getSupabaseClient } from "../db/client";
import { executeDailyMatching } from "./daily-matching";
import { runFoxConversation } from "./fox-conversation";

/** 会話間ディレイ (ms) */
const CONVERSATION_DELAY_MS = 3000;

interface BatchResult {
	batchId: string;
	totalMatches: number;
	conversationsCompleted: number;
	conversationsFailed: number;
}

/**
 * 日次バッチを実行
 */
export async function runDailyBatch(
	supabase: SupabaseClient<Database>,
	mistralApiKey: string,
	batchDate?: string,
): Promise<BatchResult> {
	const date = batchDate ?? new Date().toISOString().split("T")[0];

	// 1. daily_match_batches に insert（UNIQUE 制約で二重実行防止）
	const { data: batch, error: insertError } = await supabase
		.from("daily_match_batches")
		.insert({
			batch_date: date,
			status: "pending",
			started_at: new Date().toISOString(),
		})
		.select("id")
		.single();

	if (insertError) {
		// UNIQUE 制約違反 = 同日に既にバッチが存在
		if (insertError.code === "23505") {
			throw new Error(`Batch already exists for date: ${date}`);
		}
		throw new Error(`Failed to create batch: ${insertError.message}`);
	}

	const batchId = batch.id;

	try {
		// 2. status → 'matching'
		await supabase
			.from("daily_match_batches")
			.update({ status: "matching" })
			.eq("id", batchId);

		// 3. executeDailyMatching() を実行
		const matchResult = await executeDailyMatching(supabase, batchId);

		await supabase
			.from("daily_match_batches")
			.update({
				total_users: matchResult.totalUsers,
				users_matched: matchResult.usersMatched,
				total_matches: matchResult.totalMatches,
			})
			.eq("id", batchId);

		if (matchResult.totalMatches === 0) {
			// マッチなし → completed
			await supabase
				.from("daily_match_batches")
				.update({
					status: "completed",
					completed_at: new Date().toISOString(),
				})
				.eq("id", batchId);
			return {
				batchId,
				totalMatches: 0,
				conversationsCompleted: 0,
				conversationsFailed: 0,
			};
		}

		// 4. status → 'conversations_running'
		await supabase
			.from("daily_match_batches")
			.update({ status: "conversations_running" })
			.eq("id", batchId);

		// 5. 作成された fox_conversations を取得
		const { data: foxConvs } = await supabase
			.from("fox_conversations")
			.select("id, match_id")
			.in("match_id", matchResult.matchIds)
			.eq("status", "pending");

		// 6. 直列で runFoxConversation() を実行（レート制限対応）
		let conversationsCompleted = 0;
		let conversationsFailed = 0;

		for (let i = 0; i < (foxConvs ?? []).length; i++) {
			const conv = foxConvs![i];
			try {
				// match ステータスを in_progress に
				await supabase
					.from("matches")
					.update({
						status: "fox_conversation_in_progress",
						updated_at: new Date().toISOString(),
					})
					.eq("id", conv.match_id);

				await runFoxConversation(supabase, mistralApiKey, conv.id);
				conversationsCompleted++;
			} catch (e) {
				console.error(
					`[runDailyBatch] Fox conversation failed for ${conv.id}:`,
					e,
				);
				conversationsFailed++;
			}

			// 進捗を更新
			await supabase
				.from("daily_match_batches")
				.update({
					conversations_completed: conversationsCompleted,
					conversations_failed: conversationsFailed,
				})
				.eq("id", batchId);

			// 会話間ディレイ（レート制限回避）
			if (i < (foxConvs ?? []).length - 1) {
				await new Promise((resolve) =>
					setTimeout(resolve, CONVERSATION_DELAY_MS),
				);
			}
		}

		// 7. status → 'completed'
		await supabase
			.from("daily_match_batches")
			.update({
				status: "completed",
				conversations_completed: conversationsCompleted,
				conversations_failed: conversationsFailed,
				completed_at: new Date().toISOString(),
			})
			.eq("id", batchId);

		return {
			batchId,
			totalMatches: matchResult.totalMatches,
			conversationsCompleted,
			conversationsFailed,
		};
	} catch (e) {
		// バッチ全体の失敗
		const errorMessage =
			e instanceof Error ? e.message : "Unknown error";
		await supabase
			.from("daily_match_batches")
			.update({
				status: "failed",
				error_message: errorMessage,
				completed_at: new Date().toISOString(),
			})
			.eq("id", batchId);
		throw e;
	}
}

/**
 * Cloudflare Cron Triggers の scheduled イベントハンドラ
 */
export async function handleScheduled(
	_event: { cron: string; scheduledTime: number },
	env: {
		SUPABASE_URL: string;
		SUPABASE_SERVICE_ROLE_KEY: string;
		MISTRAL_API_KEY?: string;
	},
): Promise<void> {
	const supabase = getSupabaseClient(env as any);
	const apiKey = env.MISTRAL_API_KEY;
	if (!apiKey) {
		console.error("[handleScheduled] MISTRAL_API_KEY not configured");
		return;
	}

	try {
		const result = await runDailyBatch(supabase, apiKey);
		console.log(
			`[handleScheduled] Daily batch completed: ${result.totalMatches} matches, ${result.conversationsCompleted} conversations completed, ${result.conversationsFailed} failed`,
		);
	} catch (e) {
		console.error("[handleScheduled] Daily batch failed:", e);
	}
}
