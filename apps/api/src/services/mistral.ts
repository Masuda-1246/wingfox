import { Mistral } from "@mistralai/mistralai";

const DEFAULT_MODEL = "ministral-8b-2410";
export const MISTRAL_LARGE = "mistral-large-latest";
export const MISTRAL_LIGHT = "ministral-8b-2410";

const clientCache = new Map<string, Mistral>();

export function getMistralClient(apiKey: string) {
	const existing = clientCache.get(apiKey);
	if (existing) return existing;
	const client = new Mistral({
		apiKey,
		retryConfig: {
			strategy: "backoff",
			backoff: {
				initialInterval: 1000,
				maxInterval: 15000,
				exponent: 1.5,
				maxElapsedTime: 20000,
			},
			retryConnectionErrors: true,
		},
	});
	clientCache.set(apiKey, client);
	return client;
}

export type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

/** JSON mode を有効にすると、LM の出力が常に有効な JSON オブジェクトになる（ストラクチャードアウトプット） */
export type ChatCompleteOptions = {
	model?: string;
	maxTokens?: number;
	temperature?: number;
	/** 会話スコアなど構造化出力が必要なときに指定 */
	responseFormat?: { type: "json_object" };
};

export async function chatComplete(
	apiKey: string | undefined,
	messages: ChatMessage[],
	options?: ChatCompleteOptions,
): Promise<string> {
	if (!apiKey?.trim()) {
		throw new Error("MISTRAL_API_KEY is not set or empty. Set it in .mise.local.toml or apps/api/.env");
	}
	// Ensure every message has string content (Mistral rejects null/undefined; SDK may send invalid JSON otherwise)
	const normalizedMessages = messages.map((m) => ({
		role: m.role,
		content: typeof m.content === "string" ? m.content : "",
	}));
	const request: Parameters<Mistral["chat"]["complete"]>[0] = {
		model: options?.model ?? DEFAULT_MODEL,
		messages: normalizedMessages,
		maxTokens: options?.maxTokens ?? 1024,
		stream: false,
	};
	if (options?.temperature != null) request.temperature = options.temperature;
	if (options?.responseFormat) request.responseFormat = options.responseFormat;

	const client = getMistralClient(apiKey);
	const response = await client.chat.complete(request);
	const choice = response.choices?.[0];
	if (choice?.finishReason === "length") {
		console.warn(`[chatComplete] finish_reason=length: output may be truncated (maxTokens=${options?.maxTokens ?? 1024})`);
	}
	const content = choice?.message?.content;
	if (!content) {
		console.warn("[chatComplete] Empty response from model");
	}
	return typeof content === "string" ? content : "";
}
