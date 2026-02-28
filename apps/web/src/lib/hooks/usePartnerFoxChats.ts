import { client } from "@/api-client";
import { unwrapApiResponse } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const partnerFoxApi = client.api["partner-fox-chats"] as {
	$post: (opts: { json: { match_id: string } }) => Promise<Response>;
	":id": {
		$get: (opts: { param: { id: string } }) => Promise<Response>;
		messages: {
			$get: (opts: { param: { id: string } }) => Promise<Response>;
			$post: (opts: { param: { id: string }; json: { content: string } }) => Promise<Response>;
		};
	};
};

export function useCreatePartnerFoxChat() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (matchId: string) => {
			const res = await partnerFoxApi.$post({ json: { match_id: matchId } });
			return unwrapApiResponse(res);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["partner-fox-chats"] });
		},
	});
}

export function usePartnerFoxChat(id: string | undefined | null) {
	return useQuery({
		queryKey: ["partner-fox-chats", id],
		queryFn: async () => {
			if (!id) throw new Error("Chat id required");
			const res = await partnerFoxApi[":id"].$get({ param: { id } });
			return unwrapApiResponse(res);
		},
		enabled: Boolean(id),
	});
}

export function usePartnerFoxChatMessages(id: string | undefined | null) {
	return useQuery({
		queryKey: ["partner-fox-chats", id, "messages"],
		queryFn: async () => {
			if (!id) throw new Error("Chat id required");
			const res = await partnerFoxApi[":id"].messages.$get({ param: { id } });
			const json = await res.json();
			if ("error" in json) throw new Error(json.error.message);
			return json as { data: Array<{ id: string; role: string; content: string; created_at: string }> };
		},
		enabled: Boolean(id),
	});
}

export function useSendPartnerFoxMessage(id: string | undefined | null) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (content: string) => {
			if (!id) throw new Error("Chat id required");
			const res = await partnerFoxApi[":id"].messages.$post({
				param: { id },
				json: { content },
			});
			return unwrapApiResponse(res);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["partner-fox-chats", id, "messages"] });
		},
	});
}
