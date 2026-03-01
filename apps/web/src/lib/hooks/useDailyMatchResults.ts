import { client } from "@/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface DailyMatchPartner {
	nickname: string;
	avatar_url: string | null;
	persona_icon_url: string | null;
}

interface DailyMatchItem {
	id: string;
	partner_id: string;
	partner: DailyMatchPartner | null;
	final_score: number | null;
	profile_score: number | null;
	conversation_score: number | null;
	status: string;
	fox_conversation_id: string | null;
	score_details: {
		conversation_analysis?: {
			topic_distribution?: { topic: string; percentage: number }[];
		};
	} | null;
}

interface DailyMatchResultsData {
	batch_date: string;
	batch_status: string | null;
	matches: DailyMatchItem[];
	is_new: boolean;
	conversations_completed?: number;
	conversations_failed?: number;
	total_matches?: number;
}

export type { DailyMatchItem, DailyMatchResultsData };

export function useDailyMatchResults(options?: { enabled?: boolean }) {
	return useQuery({
		queryKey: ["matching", "daily-results"],
		queryFn: async (): Promise<DailyMatchResultsData> => {
			const res = await client.api.matching["daily-results"].$get({
				query: {},
			});
			const json = (await res.json()) as { data: DailyMatchResultsData };
			return json.data;
		},
		enabled: options?.enabled !== false,
		// バッチ実行中は5秒ポーリング
		refetchInterval: (query) => {
			const status = query.state.data?.batch_status;
			if (
				status === "pending" ||
				status === "matching" ||
				status === "conversations_running"
			) {
				return 5000;
			}
			return false;
		},
	});
}

export function useMarkDailyResultsSeen() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (date: string | undefined = undefined) => {
			const res = await client.api.matching["daily-results"].seen.$post({
				json: date ? { date } : {},
			});
			const json = (await res.json()) as { data: { updated: number } };
			return json.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["matching", "daily-results"],
			});
		},
	});
}
