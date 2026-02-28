import { client } from "@/api-client";
import { unwrapApiResponse } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const foxSearchApi = client.api["fox-search"] as {
	start: {
		$post: () => Promise<Response>;
	};
	status: {
		":conversationId": {
			$get: (opts: { param: { conversationId: string } }) => Promise<Response>;
		};
	};
};

interface StartFoxSearchResult {
	match_id: string;
	fox_conversation_id: string;
}

interface FoxConversationStatus {
	status: string;
	current_round: number;
	total_rounds: number;
	completed_at: string | null;
}

export function useStartFoxSearch() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (): Promise<StartFoxSearchResult> => {
			const res = await foxSearchApi.start.$post();
			return unwrapApiResponse<StartFoxSearchResult>(res);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["matching", "results"] });
		},
	});
}

export function useFoxConversationStatus(
	conversationId: string | null | undefined,
) {
	return useQuery<FoxConversationStatus>({
		queryKey: ["fox-search", "status", conversationId],
		queryFn: async () => {
			if (!conversationId) throw new Error("Conversation ID required");
			const res = await foxSearchApi.status[":conversationId"].$get({
				param: { conversationId },
			});
			return unwrapApiResponse<FoxConversationStatus>(res);
		},
		enabled: Boolean(conversationId),
		refetchInterval: (query) => {
			const status = query.state.data?.status;
			if (status === "completed" || status === "failed") return false;
			return 3000;
		},
	});
}
