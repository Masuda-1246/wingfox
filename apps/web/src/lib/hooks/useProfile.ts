import { client } from "@/api-client";
import { unwrapApiResponse } from "@/lib/api";
import type { ProfileMe } from "@/lib/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useProfileMe() {
	return useQuery({
		queryKey: ["profiles", "me"],
		queryFn: async (): Promise<ProfileMe> => {
			const res = await client.api.profiles.me.$get();
			return unwrapApiResponse<ProfileMe>(res);
		},
	});
}

export function useUpdateProfileMe() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (body: {
			personality_tags?: string[];
			interests?: Array<{ category: string; items: string[] }>;
			basic_info?: Record<string, unknown>;
			values?: Record<string, unknown>;
			romance_style?: Record<string, unknown>;
			lifestyle?: Record<string, unknown>;
			communication_style?: Record<string, unknown>;
		}) => {
			const res = await client.api.profiles.me.$put({ json: body });
			return unwrapApiResponse<ProfileMe>(res);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["profiles", "me"] });
		},
	});
}

export function useGenerateProfile() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async () => {
			const res = await client.api.profiles.generate.$post();
			return unwrapApiResponse<ProfileMe>(res);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["profiles", "me"] });
		},
	});
}

export function useConfirmProfile() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async () => {
			const res = await client.api.profiles.me.confirm.$post();
			return unwrapApiResponse<{ status: string; confirmed_at: string }>(res);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["profiles", "me"] });
			queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
		},
	});
}

export function useResetProfile() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async () => {
			const res = await client.api.profiles.me.reset.$post();
			return unwrapApiResponse<{ message: string; onboarding_status: string }>(res);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["profiles", "me"] });
			queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
		},
	});
}
