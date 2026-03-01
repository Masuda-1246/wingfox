import { DurableObject } from "cloudflare:workers";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../db/types";
import { z } from "zod";
import { chatComplete } from "../services/mistral";
import {
	buildFoxConversationSystemPrompt,
	buildConversationScorePrompt,
} from "../prompts/fox-conversation";
import { truncateFoxMessage } from "../lib/truncate";
import { resolveConversationLangFromUserSettings } from "../lib/lang";
import {
	hasTraitScores,
	getProfileScoreDetailsForUsers,
} from "../services/matching";
import {
	saveFeatureScores,
	loadFeatureScores,
	calculateLayerScores,
	detectDealbreakers,
	type FeatureScore,
} from "../services/compatibility";
import type {
	ServerMessage,
	ClientMessage,
	WsStateMessage,
	WsRoundMessage,
} from "./types";

const TOTAL_ROUNDS = 5;
const MAX_RETRIES = 3;

interface DOState {
	conversationId: string;
	matchId: string;
	userA: string;
	userB: string;
	systemA: string;
	systemB: string;
	lang: "ja" | "en";
	history: { speaker: "A" | "B"; content: string }[];
	currentRound: number;
	status: "in_progress" | "completed" | "failed";
	retryCount: number;
}

interface DOEnv {
	SUPABASE_URL: string;
	SUPABASE_SERVICE_ROLE_KEY: string;
	SUPABASE_ANON_KEY?: string;
	MISTRAL_API_KEY?: string;
}

export class FoxConversationDO extends DurableObject<DOEnv> {
	private getSupabase(): SupabaseClient<Database> {
		return createClient<Database>(
			this.env.SUPABASE_URL,
			this.env.SUPABASE_SERVICE_ROLE_KEY,
			{ auth: { persistSession: false } },
		);
	}

	private getSupabaseAuth(): SupabaseClient<Database> {
		const key = this.env.SUPABASE_ANON_KEY ?? this.env.SUPABASE_SERVICE_ROLE_KEY;
		return createClient<Database>(this.env.SUPABASE_URL, key, {
			auth: { persistSession: false },
		});
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		console.log(`[FoxConversationDO:fetch] ${request.method} ${url.pathname}`);

		if (request.method === "POST" && url.pathname === "/init") {
			return this.handleInit(request);
		}

		if (url.pathname === "/ws") {
			return this.handleWebSocketUpgrade(request);
		}

		return new Response("Not Found", { status: 404 });
	}

	// ── /init: Initialize conversation and start alarm chain ──

	private async handleInit(request: Request): Promise<Response> {
		const { conversationId, matchId, staggerDelayMs } = (await request.json()) as {
			conversationId: string;
			matchId: string;
			staggerDelayMs?: number;
		};

		console.log(`[FoxConversationDO:init] START conversationId=${conversationId} matchId=${matchId}`);

		const supabase = this.getSupabase();

		// Load match participants
		const { data: match, error: matchError } = await supabase
			.from("matches")
			.select("user_a_id, user_b_id")
			.eq("id", matchId)
			.single();
		if (!match) {
			console.error(`[FoxConversationDO:init] Match not found matchId=${matchId} error=`, matchError);
			return new Response("Match not found", { status: 404 });
		}
		console.log(`[FoxConversationDO:init] Match loaded userA=${match.user_a_id} userB=${match.user_b_id}`);

		// Load personas
		const [{ data: personaA, error: personaAError }, { data: personaB, error: personaBError }, { data: userProfiles }] = await Promise.all([
			supabase
				.from("personas")
				.select("compiled_document, name")
				.eq("user_id", match.user_a_id)
				.eq("persona_type", "wingfox")
				.single(),
			supabase
				.from("personas")
				.select("compiled_document, name")
				.eq("user_id", match.user_b_id)
				.eq("persona_type", "wingfox")
				.single(),
			supabase
				.from("user_profiles")
				.select("id, gender, language")
				.in("id", [match.user_a_id, match.user_b_id]),
		]);

		if (!personaA?.compiled_document || !personaB?.compiled_document) {
			console.error(`[FoxConversationDO:init] Persona not found personaA=${!!personaA?.compiled_document} personaB=${!!personaB?.compiled_document} errorA=`, personaAError, "errorB=", personaBError);
			await supabase
				.from("fox_conversations")
				.update({ status: "failed" })
				.eq("id", conversationId);
			await supabase
				.from("matches")
				.update({ status: "fox_conversation_failed" })
				.eq("id", matchId);
			return new Response("Persona not found", { status: 400 });
		}
		console.log(`[FoxConversationDO:init] Personas loaded nameA=${personaA.name} nameB=${personaB.name}`);
		const genderByUserId = new Map<string, string | null>(
			(userProfiles ?? []).map((row) => [row.id, row.gender]),
		);
		const languageByUserId = new Map<string, string | null>(
			(userProfiles ?? []).map((row) => [row.id, row.language]),
		);

		// Update conversation status
		await supabase
			.from("fox_conversations")
			.update({ status: "in_progress", started_at: new Date().toISOString() })
			.eq("id", conversationId);

		// Save state to durable storage
		const lang = resolveConversationLangFromUserSettings(
			languageByUserId.get(match.user_a_id),
			languageByUserId.get(match.user_b_id),
			personaA.compiled_document,
		);
		const state: DOState = {
			conversationId,
			matchId,
			userA: match.user_a_id,
			userB: match.user_b_id,
			systemA: buildFoxConversationSystemPrompt(
				personaA.compiled_document,
				personaA.name ?? "",
				lang,
				genderByUserId.get(match.user_a_id),
			),
			systemB: buildFoxConversationSystemPrompt(
				personaB.compiled_document,
				personaB.name ?? "",
				lang,
				genderByUserId.get(match.user_b_id),
			),
			lang,
			history: [],
			currentRound: 0,
			status: "in_progress",
			retryCount: 0,
		};
		await this.ctx.storage.put("state", state);

		// Start alarm with optional stagger delay
		const delay = staggerDelayMs ?? 0;
		await this.ctx.storage.setAlarm(Date.now() + delay);
		console.log(`[FoxConversationDO:init] DONE state saved, alarm set delay=${delay}ms conversationId=${conversationId}`);

		return new Response("OK", { status: 200 });
	}

	// ── Alarm: Process one round per alarm ──

	async alarm(): Promise<void> {
		const state = await this.ctx.storage.get<DOState>("state");
		if (!state || state.status !== "in_progress") {
			console.log(`[FoxConversationDO:alarm] SKIP state=${state?.status ?? "no state"}`);
			return;
		}

		const supabase = this.getSupabase();
		const apiKey = this.env.MISTRAL_API_KEY;
		if (!apiKey) {
			console.error(`[FoxConversationDO:alarm] MISTRAL_API_KEY not configured conversationId=${state.conversationId}`);
			await this.failConversation(supabase, state, "MISTRAL_API_KEY not configured");
			return;
		}

		const nextRound = state.currentRound + 1;
		console.log(`[FoxConversationDO:alarm] START conversationId=${state.conversationId} round=${nextRound}/${TOTAL_ROUNDS} retryCount=${state.retryCount}`);

		// Idempotency: check DB round
		const { data: conv, error: convError } = await supabase
			.from("fox_conversations")
			.select("current_round")
			.eq("id", state.conversationId)
			.single();
		if (convError) {
			console.error(`[FoxConversationDO:alarm] Failed to fetch conversation from DB conversationId=${state.conversationId}`, convError);
		}
		if (conv && conv.current_round >= nextRound) {
			console.log(`[FoxConversationDO:alarm] Idempotency skip: DB round=${conv.current_round} >= nextRound=${nextRound}`);
			// Already processed, skip to next
			if (nextRound < TOTAL_ROUNDS) {
				state.currentRound = nextRound;
				await this.ctx.storage.put("state", state);
				await this.ctx.storage.setAlarm(Date.now() + 500);
			}
			return;
		}

		try {
			// Determine speaker
			const speaker: "A" | "B" = nextRound % 2 === 1 ? "A" : "B";
			const systemPrompt = speaker === "A" ? state.systemA : state.systemB;
			const lang = state.lang ?? "ja";
			const selfLabel = lang === "en" ? "Me" : "自分";
			const otherLabel = lang === "en" ? "Them" : "相手";
			const context = state.history.length
				? state.history
						.map((m) =>
							m.speaker === speaker ? `${selfLabel}: ${m.content}` : `${otherLabel}: ${m.content}`,
						)
						.join("\n\n")
				: lang === "en" ? "Introduce yourself and ask the other person a question." : "自己紹介と、相手に一言聞いてください。";

			console.log(`[FoxConversationDO:alarm] Calling LLM speaker=${speaker} historyLen=${state.history.length} conversationId=${state.conversationId}`);

			const raw = await chatComplete(apiKey, [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: context },
			], { maxTokens: 500 });

			console.log(`[FoxConversationDO:alarm] LLM response received rawLen=${raw?.length ?? 0} conversationId=${state.conversationId}`);

			const fallback = lang === "en" ? "(No response)" : "（応答なし）";
			const content = (raw && truncateFoxMessage(raw)) || fallback;
			const speakerUserId = speaker === "A" ? state.userA : state.userB;

			// Insert message to DB
			const { error: insertError } = await supabase.from("fox_conversation_messages").insert({
				conversation_id: state.conversationId,
				speaker_user_id: speakerUserId,
				content,
				round_number: nextRound,
			});
			if (insertError) {
				console.error(`[FoxConversationDO:alarm] Failed to insert message conversationId=${state.conversationId} round=${nextRound}`, insertError);
			}

			// Update current_round in DB
			const { error: updateError } = await supabase
				.from("fox_conversations")
				.update({ current_round: nextRound })
				.eq("id", state.conversationId);
			if (updateError) {
				console.error(`[FoxConversationDO:alarm] Failed to update current_round conversationId=${state.conversationId} round=${nextRound}`, updateError);
			}

			// Broadcast to connected WebSocket clients
			const roundMsg: WsRoundMessage = {
				type: "round_message",
				round_number: nextRound,
				speaker,
				content,
			};
			this.broadcast(roundMsg);

			// Update local state
			state.history.push({ speaker, content });
			state.currentRound = nextRound;
			state.retryCount = 0;
			await this.ctx.storage.put("state", state);

			console.log(`[FoxConversationDO:alarm] Round ${nextRound} DONE conversationId=${state.conversationId}`);

			if (nextRound < TOTAL_ROUNDS) {
				// Schedule next round with jitter to desynchronize multiple DOs
				const jitter = Math.floor(Math.random() * 500);
				await this.ctx.storage.setAlarm(Date.now() + 500 + jitter);
			} else {
				// Final round — compute scores
				console.log(`[FoxConversationDO:alarm] All rounds completed, computing scores conversationId=${state.conversationId}`);
				await this.computeScores(supabase, apiKey, state);
			}
		} catch (err) {
			state.retryCount++;
			console.error(`[FoxConversationDO:alarm] ERROR round=${nextRound} retryCount=${state.retryCount}/${MAX_RETRIES} conversationId=${state.conversationId} error=`, err);
			if (state.retryCount >= MAX_RETRIES) {
				await this.failConversation(supabase, state, `Max retries exceeded: ${err}`);
			} else {
				await this.ctx.storage.put("state", state);
				// 429 rate limit errors get longer backoff than other errors
				const is429 = err instanceof Error && (
					err.message.includes("429") ||
					err.message.includes("rate") ||
					err.message.includes("Too Many Requests")
				);
				const jitter = Math.floor(Math.random() * 2000);
				const delay = is429
					? 5000 * state.retryCount + jitter
					: 2000 * state.retryCount + jitter;
				console.warn(`[FoxConversationDO:alarm] Scheduling retry ${state.retryCount} in ${delay}ms is429=${is429} conversationId=${state.conversationId}`);
				await this.ctx.storage.setAlarm(Date.now() + delay);
			}
		}
	}

	private async computeScores(
		supabase: SupabaseClient<Database>,
		apiKey: string,
		state: DOState,
	): Promise<void> {
		console.log(`[FoxConversationDO:computeScores] START conversationId=${state.conversationId}`);
		try {
			const { data: allMsgs, error: msgsError } = await supabase
				.from("fox_conversation_messages")
				.select("speaker_user_id, content, round_number")
				.eq("conversation_id", state.conversationId)
				.order("round_number");

			if (msgsError) {
				console.error(`[FoxConversationDO:computeScores] Failed to fetch messages conversationId=${state.conversationId}`, msgsError);
			}
			console.log(`[FoxConversationDO:computeScores] Messages loaded count=${allMsgs?.length ?? 0} conversationId=${state.conversationId}`);

			const logText = (allMsgs ?? [])
				.map(
					(m) =>
						`Round ${m.round_number} (${m.speaker_user_id === state.userA ? "A" : "B"}): ${m.content}`,
				)
				.join("\n");

			const FeatureScoresSchema = z.object({
				reciprocity: z.number().min(0).max(1),
				humor_sharing: z.number().min(0).max(1),
				self_disclosure: z.number().min(0).max(1),
				emotional_responsiveness: z.number().min(0).max(1),
				self_esteem: z.number().min(0).max(1),
				conflict_resolution: z.number().min(0).max(1),
			});

			const ConversationScoreSchema = z.object({
				score: z.number().min(0).max(100),
				excitement_level: z.number().min(0).max(1),
				common_topics: z.array(z.string()),
				mutual_interest: z.number().min(0).max(1),
				topic_distribution: z.array(
					z.object({ topic: z.string(), percentage: z.number() }),
				),
				feature_scores: FeatureScoresSchema,
			});

			const CONVERSATION_FEATURE_MAP: Record<string, { id: number; nameJa: string }> = {
				reciprocity: { id: 4, nameJa: "好意の返報性" },
				humor_sharing: { id: 6, nameJa: "ユーモア共有" },
				self_disclosure: { id: 7, nameJa: "自己開示" },
				emotional_responsiveness: { id: 9, nameJa: "感情的応答性" },
				self_esteem: { id: 11, nameJa: "自己肯定感" },
				conflict_resolution: { id: 14, nameJa: "葛藤解決スタイル" },
			};

			let conversationScore = 50;
			let analysis: Record<string, unknown> = {};
			let conversationFeatureScores: FeatureScore[] = [];
			try {
				console.log(`[FoxConversationDO:computeScores] Calling LLM for score conversationId=${state.conversationId}`);
				const scoreLang = state.lang ?? "ja";
				const scorePrompt = buildConversationScorePrompt(logText, scoreLang);
				const scoreRaw = await chatComplete(
					apiKey,
					[{ role: "user", content: scorePrompt }],
					{ maxTokens: 1024, responseFormat: { type: "json_object" } },
				);
				console.log(`[FoxConversationDO:computeScores] LLM score response rawLen=${scoreRaw?.length ?? 0} conversationId=${state.conversationId}`);
				const parsed = ConversationScoreSchema.parse(JSON.parse(scoreRaw));
				console.log(`[FoxConversationDO:computeScores] Score parsed score=${parsed.score} conversationId=${state.conversationId}`);
				conversationScore = parsed.score;
				analysis = {
					excitement_level: parsed.excitement_level,
					common_topics: parsed.common_topics,
					mutual_interest: parsed.mutual_interest,
					topic_distribution: parsed.topic_distribution,
				};

				// Extract per-feature scores from LLM response
				if (parsed.feature_scores) {
					for (const [key, value] of Object.entries(parsed.feature_scores)) {
						const mapping = CONVERSATION_FEATURE_MAP[key];
						if (!mapping) continue;
						conversationFeatureScores.push({
							featureId: mapping.id,
							featureName: mapping.nameJa,
							rawScore: value,
							normalizedScore: value,
							confidence: 0.7,
							evidence: { source: "fox_conversation", conversation_id: state.conversationId },
							sourcePhase: "fox_conversation",
						});
					}
				}
			} catch (e) {
				console.warn("[FoxConversationDO] Score computation failed, using default score(50):", e);
				// Fallback: generate default feature scores so fox_feature_scores is always populated
				if (conversationFeatureScores.length === 0) {
					for (const [, mapping] of Object.entries(CONVERSATION_FEATURE_MAP)) {
						conversationFeatureScores.push({
							featureId: mapping.id,
							featureName: mapping.nameJa,
							rawScore: 0.5,
							normalizedScore: 0.5,
							confidence: 0.3,
							evidence: { source: "fox_conversation_fallback", conversation_id: state.conversationId },
							sourcePhase: "fox_conversation",
						});
					}
				}
			}

			// ─── 3-layer compatibility scoring (graceful fallback) ───
			let finalScore: number;
			let layerData: Record<string, unknown> = {};

			const { data: matchRow } = await supabase
				.from("matches")
				.select("profile_score, score_details")
				.eq("id", state.matchId)
				.single();

			// Build fox_feature_scores (0-100) for frontend display
			const foxFeatureScores: Record<string, number> = {};
			for (const fs of conversationFeatureScores) {
				const entry = Object.entries(CONVERSATION_FEATURE_MAP).find(([, v]) => v.id === fs.featureId);
				if (entry) {
					foxFeatureScores[entry[0]] = Math.round(fs.normalizedScore * 100);
				}
			}

			try {
				console.log(`[FoxConversationDO:computeScores] 3-layer scoring START conversationId=${state.conversationId} featureScoreCount=${conversationFeatureScores.length}`);
				// Save conversation feature scores
				if (conversationFeatureScores.length > 0) {
					await saveFeatureScores(supabase, state.matchId, conversationFeatureScores);
				}

				let existingDetails =
					(matchRow?.score_details as Record<string, unknown>) ?? {};

				if (!hasTraitScores(existingDetails)) {
					const computed = await getProfileScoreDetailsForUsers(
						supabase,
						state.userA,
						state.userB,
					);
					if (computed) {
						await saveFeatureScores(supabase, state.matchId, computed.featureScores);
						existingDetails = { ...computed.score_details, ...existingDetails };
					}
				}

				const allFeatureScores = await loadFeatureScores(supabase, state.matchId);
				const layerScores = calculateLayerScores(allFeatureScores);
				const dealbreakers = detectDealbreakers(allFeatureScores);

				finalScore = dealbreakers.triggered ? 0 : layerScores.finalScore;
				layerData = {
					score_details: {
						...existingDetails,
						conversation_analysis: analysis,
						fox_feature_scores: foxFeatureScores,
						layer1: Math.round(layerScores.layer1 * 100),
						layer2: Math.round(layerScores.layer2 * 100),
						layer3: Math.round(layerScores.layer3 * 100),
					} as Json,
					layer_scores: {
						layer1: layerScores.layer1,
						layer2: layerScores.layer2,
						layer3: layerScores.layer3,
						feature_scores: layerScores.featureScores,
						dealbreakers: dealbreakers.triggered ? dealbreakers.features : [],
					} as Json,
				};
			} catch (e) {
				console.warn("[FoxConversationDO] 3-layer scoring failed, falling back to simple scoring:", e);
				const profileScore = (matchRow?.profile_score as number) ?? 50;
				const existingDetails =
					(matchRow?.score_details as Record<string, unknown>) ?? {};
				finalScore = profileScore * 0.4 + conversationScore * 0.6;
				layerData = {
					score_details: {
						...existingDetails,
						conversation_analysis: analysis,
						fox_feature_scores: foxFeatureScores,
					} as Json,
				};
			}

			console.log(`[FoxConversationDO:computeScores] Updating match finalScore=${finalScore} conversationScore=${conversationScore} conversationId=${state.conversationId}`);

			const { error: matchUpdateError } = await supabase
				.from("matches")
				.update({
					conversation_score: conversationScore,
					final_score: finalScore,
					...layerData,
					status: "fox_conversation_completed",
					updated_at: new Date().toISOString(),
				})
				.eq("id", state.matchId);
			if (matchUpdateError) {
				console.error(`[FoxConversationDO:computeScores] Failed to update match conversationId=${state.conversationId}`, matchUpdateError);
			}

			const { error: convUpdateError } = await supabase
				.from("fox_conversations")
				.update({
					status: "completed",
					current_round: TOTAL_ROUNDS,
					conversation_analysis: analysis as Json,
					completed_at: new Date().toISOString(),
				})
				.eq("id", state.conversationId);
			if (convUpdateError) {
				console.error(`[FoxConversationDO:computeScores] Failed to update fox_conversations conversationId=${state.conversationId}`, convUpdateError);
			}

			// Broadcast completion
			state.status = "completed";
			await this.ctx.storage.put("state", state);

			this.broadcast({
				type: "completed",
				scores: { conversation_score: conversationScore, final_score: finalScore },
				analysis,
			});

			console.log(`[FoxConversationDO:computeScores] DONE conversationId=${state.conversationId} finalScore=${finalScore}`);
		} catch (err) {
			console.error(`[FoxConversationDO:computeScores] FATAL ERROR conversationId=${state.conversationId}`, err);
			await this.failConversation(
				supabase,
				state,
				`Score computation failed: ${err}`,
			);
		}
	}

	private async failConversation(
		supabase: SupabaseClient<Database>,
		state: DOState,
		reason: string,
	): Promise<void> {
		console.error(`[FoxConversationDO:fail] conversationId=${state.conversationId} matchId=${state.matchId} round=${state.currentRound} reason=${reason}`);
		state.status = "failed";
		await this.ctx.storage.put("state", state);

		await supabase
			.from("fox_conversations")
			.update({ status: "failed" })
			.eq("id", state.conversationId);

		await supabase
			.from("matches")
			.update({ status: "fox_conversation_failed" })
			.eq("id", state.matchId);

		this.broadcast({ type: "error", message: reason });
	}

	// ── WebSocket Hibernation API ──

	private handleWebSocketUpgrade(_request: Request): Response {
		const pair = new WebSocketPair();
		const [client, server] = [pair[0], pair[1]];

		this.ctx.acceptWebSocket(server);

		return new Response(null, { status: 101, webSocket: client });
	}

	async webSocketMessage(
		ws: WebSocket,
		message: string | ArrayBuffer,
	): Promise<void> {
		if (typeof message !== "string") return;

		let parsed: ClientMessage;
		try {
			parsed = JSON.parse(message);
		} catch {
			ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
			return;
		}

		if (parsed.type === "ping") {
			ws.send(JSON.stringify({ type: "pong" }));
			return;
		}

		if (parsed.type === "auth") {
			await this.handleAuth(ws, parsed.token);
			return;
		}
	}

	async webSocketClose(
		_ws: WebSocket,
		_code: number,
		_reason: string,
		_wasClean: boolean,
	): Promise<void> {
		// Hibernation API handles cleanup automatically.
		// The DO stays alive and alarm continues.
	}

	private async handleAuth(ws: WebSocket, token: string): Promise<void> {
		console.log(`[FoxConversationDO:auth] START token=${token.slice(0, 10)}...`);
		const supabaseAuth = this.getSupabaseAuth();
		const {
			data: { user },
			error,
		} = await supabaseAuth.auth.getUser(token);

		if (error || !user) {
			console.warn(`[FoxConversationDO:auth] Auth failed error=`, error);
			ws.send(
				JSON.stringify({ type: "error", message: "Authentication failed" }),
			);
			ws.close(4001, "Unauthorized");
			return;
		}

		// Resolve user_profile.id from auth_user_id
		const supabase = this.getSupabase();
		const { data: profile, error: profileError } = await supabase
			.from("user_profiles")
			.select("id")
			.eq("auth_user_id", user.id)
			.single();

		if (!profile) {
			console.warn(`[FoxConversationDO:auth] Profile not found authUserId=${user.id} error=`, profileError);
			ws.send(
				JSON.stringify({ type: "error", message: "User profile not found" }),
			);
			ws.close(4001, "Unauthorized");
			return;
		}

		// Verify match access
		const state = await this.ctx.storage.get<DOState>("state");
		if (
			state &&
			profile.id !== state.userA &&
			profile.id !== state.userB
		) {
			console.warn(`[FoxConversationDO:auth] Access denied profileId=${profile.id} userA=${state.userA} userB=${state.userB}`);
			ws.send(
				JSON.stringify({ type: "error", message: "Access denied" }),
			);
			ws.close(4003, "Forbidden");
			return;
		}

		console.log(`[FoxConversationDO:auth] OK profileId=${profile.id} conversationId=${state?.conversationId}`);
		// Mark as authenticated
		ws.serializeAttachment({ authenticated: true, userId: profile.id });

		// Send catch-up state
		if (state) {
			const catchUp: WsStateMessage = {
				type: "state",
				status: state.status,
				current_round: state.currentRound,
				total_rounds: TOTAL_ROUNDS,
				messages: state.history.map((m, i) => ({
					round_number: i + 1,
					speaker: m.speaker,
					content: m.content,
				})),
			};
			ws.send(JSON.stringify(catchUp));
		}
	}

	private broadcast(msg: ServerMessage): void {
		const data = JSON.stringify(msg);
		for (const ws of this.ctx.getWebSockets()) {
			try {
				const attachment = ws.deserializeAttachment() as {
					authenticated?: boolean;
				} | null;
				if (attachment?.authenticated) {
					ws.send(data);
				}
			} catch {
				// Socket may be closing
			}
		}
	}
}
