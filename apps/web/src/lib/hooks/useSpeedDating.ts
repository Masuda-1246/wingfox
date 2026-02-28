import { client } from "@/api-client";
import { unwrapApiResponse } from "@/lib/api";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface SpeedDatingPersona {
	id: string;
	persona_type: string;
	name: string;
	compiled_document: string;
	sections: { section_id: string; title: string; content: string }[];
}

const speedDatingApi = client.api["speed-dating"] as {
	personas: { $get: () => Promise<Response>; $post: () => Promise<Response> };
	sessions: {
		$post: (opts: { json: { persona_id: string } }) => Promise<Response>;
		":id": {
			$get: (opts: { param: { id: string } }) => Promise<Response>;
			messages: { $post: (opts: { param: { id: string }; json: { content: string } }) => Promise<Response> };
			complete: { $post: (opts: { param: { id: string }; json?: { transcript?: { source: string; message: string }[] } }) => Promise<Response> };
			"signed-url": { $get: (opts: { param: { id: string } }) => Promise<Response> };
		};
	};
};

export function cachedPersonasQueryOptions() {
	return queryOptions({
		queryKey: ["speed-dating", "personas"],
		staleTime: 5 * 60 * 1000,
		queryFn: async (): Promise<SpeedDatingPersona[]> => {
			const res = await speedDatingApi.personas.$get();
			return unwrapApiResponse<SpeedDatingPersona[]>(res);
		},
	});
}

export function useCachedPersonas() {
	return useQuery(cachedPersonasQueryOptions());
}

export function useSpeedDatingPersonas() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async () => {
			const res = await speedDatingApi.personas.$post();
			return unwrapApiResponse<SpeedDatingPersona[]>(res);
		},
		onSuccess: (data) => {
			queryClient.setQueryData(["speed-dating", "personas"], data);
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

export function useSpeedDatingSignedUrl() {
	return useMutation({
		mutationFn: async (sessionId: string) => {
			const res = await speedDatingApi.sessions[":id"]["signed-url"].$get({
				param: { id: sessionId },
			});
			return unwrapApiResponse<{
				signed_url: string;
				overrides: {
					agent: { prompt: { prompt: string }; firstMessage?: string };
					tts?: { voiceId?: string };
				};
				persona: { name: string };
			}>(res);
		},
	});
}

type SpeedDatingTranscript = { source: string; message: string }[];

export function useCompleteSpeedDatingSession(defaultSessionId: string | undefined | null) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (
			payload?:
				| SpeedDatingTranscript
				| { sessionId?: string | null; transcript?: SpeedDatingTranscript },
		) => {
			const transcript = Array.isArray(payload) ? payload : payload?.transcript;
			const sessionId = (Array.isArray(payload) ? undefined : payload?.sessionId) ?? defaultSessionId;
			if (!sessionId) throw new Error("Session id required");
			const res = await speedDatingApi.sessions[":id"].complete.$post({
				param: { id: sessionId },
				json: transcript ? { transcript } : undefined,
			});
			return { sessionId, data: await unwrapApiResponse(res) };
		},
		onSuccess: ({ sessionId }) => {
			queryClient.invalidateQueries({ queryKey: ["speed-dating", "sessions", sessionId] });
		},
	});
}
