import { client } from "@/api-client";
import { unwrapApiResponse } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const speedDatingApi = client.api["speed-dating"] as {
	personas: { $post: () => Promise<Response> };
	sessions: {
		$post: (opts: { json: { persona_id: string } }) => Promise<Response>;
		":id": {
			$get: (opts: { param: { id: string } }) => Promise<Response>;
			messages: { $post: (opts: { param: { id: string }; json: { content: string } }) => Promise<Response> };
			complete: { $post: (opts: { param: { id: string } }) => Promise<Response> };
		};
	};
};

export function useSpeedDatingPersonas() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async () => {
			const res = await speedDatingApi.personas.$post();
			return unwrapApiResponse(res);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["personas"] });
		},
	});
}

export function useSpeedDatingSessions() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (personaId: string) => {
			const res = await speedDatingApi.sessions.$post({
				json: { persona_id: personaId },
			});
			return unwrapApiResponse(res);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["speed-dating", "sessions"] });
		},
	});
}

export function useSpeedDatingSession(sessionId: string | undefined | null) {
	return useQuery({
		queryKey: ["speed-dating", "sessions", sessionId],
		queryFn: async () => {
			if (!sessionId) throw new Error("Session id required");
			const res = await speedDatingApi.sessions[":id"].$get({
				param: { id: sessionId },
			});
			return unwrapApiResponse(res);
		},
		enabled: Boolean(sessionId),
	});
}

export function useSendSpeedDatingMessage(sessionId: string | undefined | null) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (content: string) => {
			if (!sessionId) throw new Error("Session id required");
			const res = await speedDatingApi.sessions[":id"].messages.$post({
				param: { id: sessionId },
				json: { content },
			});
			return unwrapApiResponse(res);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["speed-dating", "sessions", sessionId] });
		},
	});
}

export function useCompleteSpeedDatingSession(sessionId: string | undefined | null) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async () => {
			if (!sessionId) throw new Error("Session id required");
			const res = await speedDatingApi.sessions[":id"].complete.$post({
				param: { id: sessionId },
			});
			return unwrapApiResponse(res);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["speed-dating", "sessions", sessionId] });
		},
	});
}
