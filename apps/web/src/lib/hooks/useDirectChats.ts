import { client } from "@/api-client";
import { unwrapApiResponse } from "@/lib/api";
import {
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";

const directChatsApi = client.api["direct-chats"] as {
	$get: () => Promise<Response>;
	":id": {
		messages: {
			$get: (opts: {
				param: { id: string };
				query?: { limit?: number; cursor?: string };
			}) => Promise<Response>;
			$post: (opts: {
				param: { id: string };
				json: { content: string };
			}) => Promise<Response>;
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

export interface DirectChatMessage {
	id: string;
	sender_id: string;
	is_mine: boolean;
	content: string;
	is_read: boolean;
	created_at: string;
}

interface DirectChatMessagesPage {
	data: DirectChatMessage[];
	next_cursor: string | null;
	has_more: boolean;
}

export function useDirectChatMessages(
	roomId: string | undefined | null,
	params?: { limit?: number },
) {
	return useInfiniteQuery<DirectChatMessagesPage, Error>({
		queryKey: ["direct-chats", roomId, "messages"],
		queryFn: async ({ pageParam }) => {
			if (!roomId) throw new Error("Room id required");
			const res = await directChatsApi[":id"].messages.$get({
				param: { id: roomId },
				query: { ...params, cursor: pageParam as string | undefined },
			});
			const json = await res.json();
			if ("error" in json) throw new Error(json.error.message);
			return json as DirectChatMessagesPage;
		},
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
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
		onMutate: async (content) => {
			const queryKey = ["direct-chats", roomId, "messages"];
			await queryClient.cancelQueries({ queryKey });
			const previous = queryClient.getQueryData(queryKey);
			queryClient.setQueryData(queryKey, (old: unknown) => {
				if (!old || typeof old !== "object" || !("pages" in old)) return old;
				const o = old as { pages: Array<{ data: unknown[] }> };
				if (!o.pages?.[0]) return old;
				return {
					...o,
					pages: [
						{
							...o.pages[0],
							data: [
								{
									id: `optimistic-${Date.now()}`,
									sender_id: "me",
									is_mine: true,
									content,
									is_read: false,
									created_at: new Date().toISOString(),
								},
								...o.pages[0].data,
							],
						},
						...o.pages.slice(1),
					],
				};
			});
			return { previous };
		},
		onError: (_err, _content, context) => {
			if (context?.previous) {
				queryClient.setQueryData(
					["direct-chats", roomId, "messages"],
					context.previous,
				);
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["direct-chats", roomId, "messages"],
			});
			queryClient.invalidateQueries({ queryKey: ["direct-chats"] });
		},
	});
}
