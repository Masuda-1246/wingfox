import { client } from "@/api-client";
import { unwrapApiResponse } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const directChatsApi = client.api["direct-chats"] as {
	$get: () => Promise<Response>;
	":id": {
		messages: {
			$get: (opts: { param: { id: string }; query?: { limit?: number; cursor?: string } }) => Promise<Response>;
			$post: (opts: { param: { id: string }; json: { content: string } }) => Promise<Response>;
		};
	};
};

export interface DirectChatRoom {
	id: string;
	match_id: string;
	partner?: { nickname: string; avatar_url: string | null };
	last_message?: { content: string; created_at: string; sender_id: string };
}

export function useDirectChatRooms() {
	return useQuery({
		queryKey: ["direct-chats"],
		queryFn: async (): Promise<DirectChatRoom[]> => {
			const res = await directChatsApi.$get();
			return unwrapApiResponse<DirectChatRoom[]>(res);
		},
	});
}

export function useDirectChatMessages(
	roomId: string | undefined | null,
	params?: { limit?: number; cursor?: string },
) {
	return useQuery({
		queryKey: ["direct-chats", roomId, "messages", params],
		queryFn: async () => {
			if (!roomId) throw new Error("Room id required");
			const res = await directChatsApi[":id"].messages.$get({
				param: { id: roomId },
				query: params,
			});
			const json = await res.json();
			if ("error" in json) throw new Error(json.error.message);
			return json as {
				data: Array<{ id: string; content: string; created_at: string; sender_id: string }>;
				next_cursor: string | null;
				has_more: boolean;
			};
		},
		enabled: Boolean(roomId),
	});
}

export function useSendDirectChatMessage(roomId: string | undefined | null) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (content: string) => {
			if (!roomId) throw new Error("Room id required");
			const res = await directChatsApi[":id"].messages.$post({
				param: { id: roomId },
				json: { content },
			});
			return unwrapApiResponse(res);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["direct-chats", roomId, "messages"] });
			queryClient.invalidateQueries({ queryKey: ["direct-chats"] });
		},
	});
}
