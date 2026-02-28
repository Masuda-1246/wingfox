import { client } from "@/api-client";
import { unwrapApiResponse } from "@/lib/api";
import type { MatchResultDetail, MatchResultItem } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";

interface MatchingResultsResponse {
	data: MatchResultItem[];
	next_cursor: string | null;
	has_more: boolean;
}

export function useMatchingResults(
	params?: { limit?: number; cursor?: string; status?: string },
	options?: { enabled?: boolean },
) {
	return useQuery({
		queryKey: ["matching", "results", params],
		queryFn: async (): Promise<MatchingResultsResponse> => {
			const query: Record<string, string> = {};
			if (params?.limit != null) query.limit = String(params.limit);
			if (params?.cursor) query.cursor = params.cursor;
			if (params?.status) query.status = params.status;
			const res = await client.api.matching.results.$get({ query });
			const json = await res.json();
			if ("error" in json) throw new Error(json.error.message);
			return json as MatchingResultsResponse;
		},
		enabled: options?.enabled !== false,
	});
}

export function useMatchingResult(id: string | undefined | null, options?: { enabled?: boolean }) {
	return useQuery({
		queryKey: ["matching", "results", id],
		queryFn: async (): Promise<MatchResultDetail> => {
			if (!id) throw new Error("Match id required");
			const res = await client.api.matching.results[":id"].$get({ param: { id } });
			return unwrapApiResponse<MatchResultDetail>(res);
		},
		enabled: Boolean(id) && (options?.enabled !== false),
	});
}
