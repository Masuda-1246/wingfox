import { client } from "@/api-client";
import { unwrapApiResponse } from "@/lib/api";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface AuthMe {
	id: string;
	nickname: string;
	gender?: string | null;
	birth_year?: number | null;
	onboarding_status: string;
	avatar_url?: string | null;
}

export function authMeQueryOptions() {
	return queryOptions({
		queryKey: ["auth", "me"],
		queryFn: async (): Promise<AuthMe> => {
			const res = await client.api.auth.me.$get();
			return unwrapApiResponse<AuthMe>(res);
		},
	});
}

export function useAuthMe() {
	return useQuery(authMeQueryOptions());
}

export function useUpdateAuthMe() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (body: {
			nickname?: string;
			gender?: "male" | "female" | "other" | "undisclosed";
			birth_year?: number | null;
		}) => {
			const res = await client.api.auth.me.$put({ json: body });
			return unwrapApiResponse<AuthMe>(res);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
		},
	});
}
