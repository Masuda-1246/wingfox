import { useConversation } from "@elevenlabs/react";
import { useCallback, useRef, useState } from "react";

export type SpeedDateStatus = "idle" | "connecting" | "talking" | "done";

export interface TranscriptEntry {
	id?: string;
	source: "user" | "ai";
	message: string;
	timestamp: number;
}

export interface SpeedDateConfig {
	signedUrl?: string;
	agentId?: string;
	connectionType?: "websocket" | "webrtc";
	overrides?: {
		agent?: {
			prompt?: { prompt: string };
			firstMessage?: string;
			language?: string;
		};
		tts?: {
			voiceId?: string;
		};
	};
}

const DURATION_MS = 2 * 60 * 1000; // 2 minutes
const CONNECT_TIMEOUT_MS = 15_000; // fail fast if websocket never connects

export function useSpeedDate() {
	const [status, setStatus] = useState<SpeedDateStatus>("idle");
	const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
	const [remainingMs, setRemainingMs] = useState(DURATION_MS);
	const [error, setError] = useState<string | null>(null);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const endTimeRef = useRef<number>(0);
	const hasConnectedRef = useRef(false);

	const stopTimer = useCallback(() => {
		if (timerRef.current) {
			clearInterval(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	const clearConnectTimeout = useCallback(() => {
		if (connectTimeoutRef.current) {
			clearTimeout(connectTimeoutRef.current);
			connectTimeoutRef.current = null;
		}
	}, []);

	const conversation = useConversation({
		onConnect: () => {
			console.log("[SpeedDate] Connected");
			clearConnectTimeout();
			hasConnectedRef.current = true;
			setError(null);
			setStatus("talking");
			endTimeRef.current = Date.now() + DURATION_MS;
			timerRef.current = setInterval(() => {
				const remaining = Math.max(0, endTimeRef.current - Date.now());
				setRemainingMs(remaining);
				if (remaining <= 0) {
					conversationRef.current?.endSession();
				}
			}, 200);
		},
		onDisconnect: (details) => {
			console.log("[SpeedDate] Disconnected:", details);
			stopTimer();
			clearConnectTimeout();
			if (hasConnectedRef.current) {
				setStatus("done");
			} else {
				setError(
					details.reason === "error"
						? details.message
						: "接続に失敗しました。もう一度お試しください。",
				);
				setStatus("idle");
			}
			hasConnectedRef.current = false;
		},
		onMessage: ({ source, message }) => {
			setTranscript((prev) => [
				...prev,
				{
					id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
					source: source === "ai" ? "ai" : "user",
					message,
					timestamp: Date.now(),
				},
			]);
		},
		onError: (message) => {
			console.error("[SpeedDate] Error:", message);
			setError(message);
		},
	});

	const conversationRef = useRef(conversation);
	conversationRef.current = conversation;

	const startDate = useCallback(
		async (config: SpeedDateConfig) => {
			setTranscript([]);
			setRemainingMs(DURATION_MS);
			setError(null);
			setStatus("connecting");
			hasConnectedRef.current = false;
			clearConnectTimeout();
			try {
				// Request microphone permission first for a clearer error
				await navigator.mediaDevices.getUserMedia({ audio: true });
				connectTimeoutRef.current = setTimeout(() => {
					if (!hasConnectedRef.current) {
						console.error("[SpeedDate] Connection timeout");
						setError(
							"接続に時間がかかっています。ネットワークを確認して、もう一度お試しください。",
						);
						setStatus("idle");
						void conversationRef.current.endSession().catch(() => undefined);
					}
				}, CONNECT_TIMEOUT_MS);
				if (config.agentId) {
					await conversationRef.current.startSession({
						agentId: config.agentId,
						connectionType: config.connectionType ?? "websocket",
						overrides: config.overrides,
					});
				} else if (config.signedUrl) {
					await conversationRef.current.startSession({
						signedUrl: config.signedUrl,
						overrides: config.overrides,
					});
				} else {
					throw new Error("agentId or signedUrl is required");
				}
			} catch (err) {
				clearConnectTimeout();
				console.error("[SpeedDate] Failed to start session:", err);
				const msg = err instanceof Error ? err.message : String(err);
				if (
					msg.includes("Permission") ||
					msg.includes("NotAllowedError") ||
					msg.includes("dismissed")
				) {
					setError(
						"マイクのアクセスを許可してください。ブラウザのアドレスバーからマイクを許可できます。",
					);
				} else {
					setError(msg || "セッションの開始に失敗しました");
				}
				setStatus("idle");
			}
		},
		[clearConnectTimeout],
	);

	const endDate = useCallback(async () => {
		clearConnectTimeout();
		await conversationRef.current.endSession();
	}, [clearConnectTimeout]);

	const reset = useCallback(() => {
		clearConnectTimeout();
		setStatus("idle");
		setTranscript([]);
		setRemainingMs(DURATION_MS);
		setError(null);
	}, [clearConnectTimeout]);

	return {
		status,
		isSpeaking: conversation.isSpeaking,
		connectionStatus: conversation.status,
		transcript,
		remainingMs,
		error,
		startDate,
		endDate,
		reset,
	};
}
