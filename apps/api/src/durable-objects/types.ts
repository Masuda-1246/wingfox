// ── Server → Client messages ──

export interface WsStateMessage {
	type: "state";
	status: "in_progress" | "completed" | "failed";
	current_round: number;
	total_rounds: number;
	messages: { round_number: number; speaker: "A" | "B"; content: string }[];
}

export interface WsRoundMessage {
	type: "round_message";
	round_number: number;
	speaker: "A" | "B";
	content: string;
}

export interface WsCompletedMessage {
	type: "completed";
	scores: {
		conversation_score: number;
		final_score: number;
	};
	analysis: Record<string, unknown>;
}

export interface WsErrorMessage {
	type: "error";
	message: string;
}

export interface WsPongMessage {
	type: "pong";
}

export type ServerMessage =
	| WsStateMessage
	| WsRoundMessage
	| WsCompletedMessage
	| WsErrorMessage
	| WsPongMessage;

// ── Client → Server messages ──

export interface WsAuthMessage {
	type: "auth";
	token: string;
}

export interface WsPingMessage {
	type: "ping";
}

export type ClientMessage = WsAuthMessage | WsPingMessage;
