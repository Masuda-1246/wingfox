import { client } from "@/api-client";
import { unwrapApiResponse } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const chatRequestsApi = client.api["chat-requests"] as {
	$post: (opts: { json: { match_id: string } }) => Promise<Response>;
	$get: () => Promise<Response>;
	":id": {
		$put: (opts: {
			param: { id: string };
			json: { action: "accept" | "decline" };
		}) => Promise<Response>;
	};
};

export interface PendingChatRequest {
	id: string;
	match_id: string;
	requester_id: string;
	status: string;
	expires_at: string;
	created_at: string;
	requester: { nickname: string };
	final_score: number | null;
}

export function useRequestDirectChat() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (matchId: string) => {
			const res = await chatRequestsApi.$post({
				json: { match_id: matchId },
			});
			return unwrapApiResponse(res);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["matching", "results"] });
		},
	});
}

export function usePendingChatRequests(options?: { refetchInterval?: number }) {
	return useQuery({
		queryKey: ["chat-requests", "pending"],
		queryFn: async (): Promise<PendingChatRequest[]> => {
			const res = await chatRequestsApi.$get();
			return unwrapApiResponse<PendingChatRequest[]>(res);
		},
		refetchInterval: options?.refetchInterval,
	});
}

export function useRespondChatRequest() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({
			id,
			action,
		}: { id: string; action: "accept" | "decline" }) => {
			const res = await chatRequestsApi[":id"].$put({
				param: { id },
				json: { action },
			});
			return unwrapApiResponse(res);
		},
		onSuccess: () => {
			void queryClient.refetchQueries({ queryKey: ["chat-requests"] });
			queryClient.invalidateQueries({ queryKey: ["matching", "results"] });
			void queryClient.refetchQueries({ queryKey: ["direct-chats"] });
		},
	});
}
