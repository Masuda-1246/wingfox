import { client } from "@/api-client";
import { unwrapApiResponse } from "@/lib/api";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";

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
	conversations: { match_id: string; fox_conversation_id: string }[];
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
		onError: () => {
			// Chat.tsx の handleStartFoxSearch で個別にハンドリングするため
			// グローバル onError（query-client.ts）の toast.error を抑制
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

export function useMultipleFoxConversationStatus(conversationIds: string[]) {
	const queries = useQueries({
		queries: conversationIds.map((id) => ({
			queryKey: ["fox-search", "status", id],
			queryFn: async () => {
				const res = await foxSearchApi.status[":conversationId"].$get({
					param: { conversationId: id },
				});
				return unwrapApiResponse<FoxConversationStatus>(res);
			},
			enabled: Boolean(id),
			refetchInterval: (query: { state: { data?: FoxConversationStatus } }) => {
				const status = query.state.data?.status;
				if (status === "completed" || status === "failed") return false;
				return 3000;
			},
		})),
	});

	const statuses = queries.map((q) => q.data);
	const allTerminal =
		conversationIds.length > 0 &&
		statuses.every(
			(s) => s?.status === "completed" || s?.status === "failed",
		);
	const completedCount = statuses.filter((s) => s?.status === "completed").length;
	const failedCount = statuses.filter((s) => s?.status === "failed").length;

	// Aggregate progress across all conversations
	const totalRounds = statuses.reduce((sum, s) => sum + (s?.total_rounds ?? 0), 0);
	const currentRounds = statuses.reduce((sum, s) => sum + (s?.current_round ?? 0), 0);

	const statusMap = new Map<string, FoxConversationStatus | undefined>();
	conversationIds.forEach((id, i) => {
		statusMap.set(id, statuses[i]);
	});

	return {
		queries,
		statuses,
		statusMap,
		allTerminal,
		completedCount,
		failedCount,
		totalRounds,
		currentRounds,
		total: conversationIds.length,
	};
}
