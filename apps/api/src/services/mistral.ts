import { Mistral } from "@mistralai/mistralai";

const DEFAULT_MODEL = "mistral-small-latest";

export function getMistralClient(apiKey: string) {
	return new Mistral({ apiKey });
}

export type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

export async function chatComplete(
	apiKey: string,
	messages: ChatMessage[],
	options?: { model?: string; maxTokens?: number },
): Promise<string> {
	const client = getMistralClient(apiKey);
	const response = await client.chat.complete({
		model: options?.model ?? DEFAULT_MODEL,
		messages: messages.map((m) => ({ role: m.role, content: m.content })),
		maxTokens: options?.maxTokens ?? 1024,
	});
	const content = response.choices?.[0]?.message?.content;
	return typeof content === "string" ? content : "";
}
