import { useConversation } from "@elevenlabs/react";
import { useCallback, useRef, useState } from "react";

export type SpeedDateStatus = "idle" | "talking" | "done";

export interface TranscriptEntry {
	source: "user" | "ai";
	message: string;
	timestamp: number;
}

const DURATION_MS = 2 * 60 * 1000; // 2 minutes
const ELEVENLABS_AGENT_ID = "agent_0101kjhezyxvehvbdrdp7k3p3gek";

export function useSpeedDate() {
	const [status, setStatus] = useState<SpeedDateStatus>("idle");
	const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
	const [remainingMs, setRemainingMs] = useState(DURATION_MS);
	const [error, setError] = useState<string | null>(null);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const endTimeRef = useRef<number>(0);
	const hasConnectedRef = useRef(false);

	const conversation = useConversation({
		onConnect: () => {
			console.log("[SpeedDate] Connected");
			hasConnectedRef.current = true;
			setError(null);
			setStatus("talking");
			startTimer();
		},
		onDisconnect: (details) => {
			console.log("[SpeedDate] Disconnected:", details);
			stopTimer();
			if (hasConnectedRef.current) {
				setStatus("done");
			} else {
				// Connection failed before we ever connected
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

	const startTimer = useCallback(() => {
		endTimeRef.current = Date.now() + DURATION_MS;
		timerRef.current = setInterval(() => {
			const remaining = Math.max(0, endTimeRef.current - Date.now());
			setRemainingMs(remaining);
			if (remaining <= 0) {
				conversation.endSession();
			}
		}, 200);
	}, [conversation]);

	const stopTimer = useCallback(() => {
		if (timerRef.current) {
			clearInterval(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	const startDate = useCallback(async () => {
		setTranscript([]);
		setRemainingMs(DURATION_MS);
		setError(null);
		try {
			await conversation.startSession({
				agentId: ELEVENLABS_AGENT_ID,
				connectionType: "webrtc",
			});
		} catch (err) {
			console.error("[SpeedDate] Failed to start session:", err);
			setError(
				err instanceof Error ? err.message : "セッションの開始に失敗しました",
			);
			setStatus("idle");
		}
	}, [conversation]);

	const endDate = useCallback(async () => {
		await conversation.endSession();
	}, [conversation]);

	const reset = useCallback(() => {
		setStatus("idle");
		setTranscript([]);
		setRemainingMs(DURATION_MS);
		setError(null);
	}, []);

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
