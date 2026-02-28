import { Mistral } from "@mistralai/mistralai";

const DEFAULT_MODEL = "ministral-8b-latest";
export const MISTRAL_LARGE = "mistral-large-latest";
export const MISTRAL_LIGHT = "ministral-8b-latest";

export function getMistralClient(apiKey: string) {
	return new Mistral({ apiKey });
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
	const client = getMistralClient(apiKey);
	const response = await client.chat.complete({
		model: options?.model ?? DEFAULT_MODEL,
		messages: messages.map((m) => ({ role: m.role, content: m.content })),
		maxTokens: options?.maxTokens ?? 1024,
		temperature: options?.temperature,
		...(options?.responseFormat && { responseFormat: options.responseFormat }),
	});
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
