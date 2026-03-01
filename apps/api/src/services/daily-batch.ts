/**
 * Daily Batch Orchestration
 *
 * 日次バッチの全体フロー:
 *  1. executeDailyMatching() でマッチ作成 + daily_match_pairs 記録
 *  2. fox_conversations を直列実行（レート制限対応）
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../db/types";
import { getSupabaseClient } from "../db/client";
import { getTodayInTimeZone, TOKYO_TIMEZONE } from "../lib/date";
import { executeDailyMatching } from "./daily-matching";
import { runFoxConversation } from "./fox-conversation";
import type { DONamespace } from "../env";

/** 会話間ディレイ (ms) */
const CONVERSATION_DELAY_MS = 3000;

interface BatchResult {
	batchDate: string;
	totalMatches: number;
	conversationsCompleted: number;
	conversationsFailed: number;
}

interface RunDailyBatchOptions {
	foxConversationDO?: DONamespace;
}

/**
 * 日次バッチを実行
 */
export async function runDailyBatch(
	supabase: SupabaseClient<Database>,
	mistralApiKey: string,
	batchDate?: string,
	options?: RunDailyBatchOptions,
): Promise<BatchResult> {
	const date = batchDate ?? getTodayInTimeZone(TOKYO_TIMEZONE);

	// 1. executeDailyMatching() を実行
	const matchResult = await executeDailyMatching(supabase, date);
	if (matchResult.totalMatches === 0) {
		return {
			batchDate: date,
			totalMatches: 0,
			conversationsCompleted: 0,
			conversationsFailed: 0,
		};
	}

	// 2. 作成された fox_conversations を取得
	const { data: foxConvs } = await supabase
		.from("fox_conversations")
		.select("id, match_id")
		.in("match_id", matchResult.matchIds)
		.eq("status", "pending");

	// 3. 直列で runFoxConversation() を実行（レート制限対応）
	let conversationsCompleted = 0;
	let conversationsFailed = 0;

	if (options?.foxConversationDO) {
		for (let i = 0; i < (foxConvs ?? []).length; i++) {
			const conv = foxConvs![i];
			try {
				await supabase
					.from("matches")
					.update({
						status: "fox_conversation_in_progress",
						updated_at: new Date().toISOString(),
					})
					.eq("id", conv.match_id);

				const doId = options.foxConversationDO.idFromName(conv.id);
				const stub = options.foxConversationDO.get(doId);
				const staggerDelayMs = i * 1200;
				const response = await stub.fetch(
					new Request("https://do/init", {
						method: "POST",
						body: JSON.stringify({
							conversationId: conv.id,
							matchId: conv.match_id,
							staggerDelayMs,
						}),
					}),
				);
				if (!response.ok) {
					throw new Error(`DO init failed with status ${response.status}`);
				}
				conversationsCompleted++;
			} catch (e) {
				console.error(
					`[runDailyBatch] Failed to start FoxConversationDO for ${conv.id}:`,
					e,
				);
				conversationsFailed++;
				await supabase
					.from("fox_conversations")
					.update({ status: "failed" })
					.eq("id", conv.id);
				await supabase
					.from("matches")
					.update({
						status: "fox_conversation_failed",
						updated_at: new Date().toISOString(),
					})
					.eq("id", conv.match_id);
			}
		}

		return {
			batchDate: date,
			totalMatches: matchResult.totalMatches,
			conversationsCompleted,
			conversationsFailed,
		};
	}

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
			// throwで抜けた場合、fc/matchのステータスがin_progressのまま残るので更新
			await supabase
				.from("fox_conversations")
				.update({ status: "failed" })
				.eq("id", conv.id);
			await supabase
				.from("matches")
				.update({
					status: "fox_conversation_failed",
					updated_at: new Date().toISOString(),
				})
				.eq("id", conv.match_id);
		}

		// 会話間ディレイ（レート制限回避）
		if (i < (foxConvs ?? []).length - 1) {
			await new Promise((resolve) =>
				setTimeout(resolve, CONVERSATION_DELAY_MS),
			);
		}
	}

	return {
		batchDate: date,
		totalMatches: matchResult.totalMatches,
		conversationsCompleted,
		conversationsFailed,
	};
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
		FOX_CONVERSATION?: DONamespace;
	},
): Promise<void> {
	const supabase = getSupabaseClient(env as any);
	const apiKey = env.MISTRAL_API_KEY;
	if (!apiKey) {
		console.error("[handleScheduled] MISTRAL_API_KEY not configured");
		return;
	}

	try {
		const result = await runDailyBatch(supabase, apiKey, undefined, {
			foxConversationDO: env.FOX_CONVERSATION,
		});
		console.log(
			`[handleScheduled] Daily batch completed: ${result.totalMatches} matches, ${result.conversationsCompleted} conversations completed, ${result.conversationsFailed} failed`,
		);
	} catch (e) {
		console.error("[handleScheduled] Daily batch failed:", e);
	}
}
