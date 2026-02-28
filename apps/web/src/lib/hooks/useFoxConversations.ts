import { client } from "@/api-client";
import { unwrapApiResponse } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export interface FoxConversationMessage {
	id: string;
	speaker: "my_fox" | "partner_fox";
	content: string;
	round_number: number;
	created_at: string;
}

export function useFoxConversation(id: string | undefined | null) {
	return useQuery({
		queryKey: ["fox-conversations", id],
		queryFn: async () => {
			if (!id) throw new Error("Conversation id required");
			const res = await client.api["fox-conversations"][":id"].$get({
				param: { id },
			});
			return unwrapApiResponse(res);
		},
		enabled: Boolean(id),
	});
}

export function useFoxConversationMessages(
	id: string | undefined | null,
	params?: { limit?: number; cursor?: string },
) {
	return useQuery({
		queryKey: ["fox-conversations", id, "messages", params],
		queryFn: async () => {
			if (!id) throw new Error("Conversation id required");
			const res = await client.api["fox-conversations"][":id"].messages.$get({
				param: { id },
				query: params as { limit?: number; cursor?: string },
			});
			const json = await res.json();
			if ("error" in json) throw new Error(json.error.message);
			return json as {
				data: FoxConversationMessage[];
				next_cursor: string | null;
				has_more: boolean;
			};
		},
		enabled: Boolean(id),
	});
}
