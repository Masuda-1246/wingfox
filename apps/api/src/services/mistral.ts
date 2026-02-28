import { Mistral } from "@mistralai/mistralai";

const DEFAULT_MODEL = "mistral-small-latest";

export function getMistralClient(apiKey: string) {
	return new Mistral({ apiKey });
}

export type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

export async function chatComplete(
	apiKey: string | undefined,
	messages: ChatMessage[],
	options?: { model?: string; maxTokens?: number },
): Promise<string> {
	if (!apiKey?.trim()) {
		throw new Error("MISTRAL_API_KEY is not set or empty. Set it in .mise.local.toml or apps/api/.env");
	}
	const client = getMistralClient(apiKey);
	const response = await client.chat.complete({
		model: options?.model ?? DEFAULT_MODEL,
		messages: messages.map((m) => ({ role: m.role, content: m.content })),
		maxTokens: options?.maxTokens ?? 1024,
	});
	const content = response.choices?.[0]?.message?.content;
	return typeof content === "string" ? content : "";
}
