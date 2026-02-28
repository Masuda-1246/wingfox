import { client } from "@/api-client";
import { unwrapApiResponse } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export type ReportReason = "harassment" | "inappropriate" | "spam" | "other";

export function useReportUser() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (body: {
			user_id: string;
			reason: ReportReason;
			description?: string;
			message_id?: string;
		}) => {
			const res = await client.api.moderation.reports.$post({ json: body });
			return unwrapApiResponse<{ report_id: string; status: string }>(res);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["moderation"] });
		},
	});
}

export function useBlockUser() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (userId: string) => {
			const res = await client.api.moderation.blocks.$post({
				json: { user_id: userId },
			});
			return unwrapApiResponse<{ message: string }>(res);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["moderation"] });
			queryClient.invalidateQueries({ queryKey: ["matching"] });
		},
	});
}

export function useUnblockUser() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (userId: string) => {
			const res = await client.api.moderation.blocks[":userId"].$delete({
				param: { userId },
			});
			return unwrapApiResponse<{ message: string }>(res);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["moderation"] });
		},
	});
}
