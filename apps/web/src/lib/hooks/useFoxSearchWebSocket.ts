import { supabase } from "@/lib/supabase";
import { useCallback, useEffect, useRef, useState } from "react";

interface RoundMessage {
	round_number: number;
	speaker: "A" | "B";
	content: string;
}

interface FoxSearchWsState {
	status:
		| "connecting"
		| "in_progress"
		| "completed"
		| "failed"
		| "disconnected";
	current_round: number;
	total_rounds: number;
	messages: RoundMessage[];
	scores: { conversation_score: number; final_score: number } | null;
	analysis: Record<string, unknown> | null;
}

const HEARTBEAT_INTERVAL = 30_000;
const RECONNECT_DELAY = 3_000;

export function useFoxSearchWebSocket(
	conversationId: string | null | undefined,
): FoxSearchWsState & { connected: boolean } {
	const [state, setState] = useState<FoxSearchWsState>({
		status: "disconnected",
		current_round: 0,
		total_rounds: 5,
		messages: [],
		scores: null,
		analysis: null,
	});
	const [connected, setConnected] = useState(false);

	const wsRef = useRef<WebSocket | null>(null);
	const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const terminalRef = useRef(false);

	const cleanup = useCallback(() => {
		if (heartbeatRef.current) {
			clearInterval(heartbeatRef.current);
			heartbeatRef.current = null;
		}
		if (reconnectTimerRef.current) {
			clearTimeout(reconnectTimerRef.current);
			reconnectTimerRef.current = null;
		}
		if (wsRef.current) {
			wsRef.current.close();
			wsRef.current = null;
		}
		setConnected(false);
	}, []);

	const connect = useCallback(
		async (convId: string) => {
			cleanup();
			terminalRef.current = false;
			setState((prev) => ({ ...prev, status: "connecting" }));

			// Build WebSocket URL
			const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
			const wsUrl = `${protocol}//${window.location.host}/api/fox-search/ws/${convId}`;

			const ws = new WebSocket(wsUrl);
			wsRef.current = ws;

			ws.onopen = async () => {
				setConnected(true);

				// Send auth message with Supabase JWT
				const { data } = await supabase.auth.getSession();
				if (data.session?.access_token) {
					ws.send(
						JSON.stringify({ type: "auth", token: data.session.access_token }),
					);
				}

				// Start heartbeat
				heartbeatRef.current = setInterval(() => {
					if (ws.readyState === WebSocket.OPEN) {
						ws.send(JSON.stringify({ type: "ping" }));
					}
				}, HEARTBEAT_INTERVAL);
			};

			ws.onmessage = (event) => {
				try {
					const msg = JSON.parse(event.data);
					switch (msg.type) {
						case "state":
							setState({
								status: msg.status,
								current_round: msg.current_round,
								total_rounds: msg.total_rounds,
								messages: msg.messages ?? [],
								scores: null,
								analysis: null,
							});
							break;
						case "round_message":
							setState((prev) => ({
								...prev,
								status: "in_progress",
								current_round: msg.round_number,
								messages: [
									...prev.messages,
									{
										round_number: msg.round_number,
										speaker: msg.speaker,
										content: msg.content,
									},
								],
							}));
							break;
						case "completed":
							terminalRef.current = true;
							setState((prev) => ({
								...prev,
								status: "completed",
								scores: msg.scores,
								analysis: msg.analysis,
							}));
							break;
						case "error":
							terminalRef.current = true;
							setState((prev) => ({
								...prev,
								status: "failed",
							}));
							break;
						case "pong":
							break;
					}
				} catch {
					// Ignore malformed messages
				}
			};

			ws.onclose = () => {
				setConnected(false);
				if (heartbeatRef.current) {
					clearInterval(heartbeatRef.current);
					heartbeatRef.current = null;
				}

				// Auto-reconnect unless terminal state
				if (!terminalRef.current && convId) {
					setState((prev) => ({ ...prev, status: "disconnected" }));
					reconnectTimerRef.current = setTimeout(
						() => connect(convId),
						RECONNECT_DELAY,
					);
				}
			};

			ws.onerror = () => {
				// onclose will fire after onerror
			};
		},
		[cleanup],
	);

	useEffect(() => {
		if (!conversationId) {
			cleanup();
			setState({
				status: "disconnected",
				current_round: 0,
				total_rounds: 5,
				messages: [],
				scores: null,
				analysis: null,
			});
			terminalRef.current = false;
			return;
		}

		connect(conversationId);
		return cleanup;
	}, [conversationId, connect, cleanup]);

	return { ...state, connected };
}
