import { client } from "@/api-client";
import { unwrapApiResponse } from "@/lib/api";
import {
	queryOptions,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";

export interface AuthMe {
	id: string;
	nickname: string;
	gender?: string | null;
	birth_year?: number | null;
	language?: "ja" | "en";
	onboarding_status: string;
	avatar_url?: string | null;
	notification_seen_at?: string | null;
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

export function useAuthMe(options?: { enabled?: boolean }) {
	return useQuery({
		...authMeQueryOptions(),
		enabled: options?.enabled !== false,
	});
}

export function useUpdateAuthMe() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (body: {
			nickname?: string;
			gender?: "male" | "female" | "other" | "undisclosed";
			birth_year?: number | null;
			language?: "ja" | "en";
		}) => {
			const res = await client.api.auth.me.$put({ json: body });
			return unwrapApiResponse<AuthMe>(res);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
		},
	});
}

/** Mark notification dropdown as seen (updates notification_seen_at in DB). Call when user opens the notification dropdown. */
export function useMarkNotificationSeen() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async () => {
			const res = await (
				client.api.auth.me as {
					"notification-seen": { $post: () => Promise<Response> };
				}
			)["notification-seen"].$post();
			return unwrapApiResponse<{ notification_seen_at: string }>(res);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
		},
	});
}
