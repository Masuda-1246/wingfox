import { client } from "@/api-client";
import { unwrapApiResponse } from "@/lib/api";
import type { PersonaListItem, PersonaSection } from "@/lib/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function usePersonasList(personaType?: string) {
	return useQuery({
		queryKey: ["personas", "list", personaType],
		queryFn: async (): Promise<PersonaListItem[]> => {
			const res = await client.api.personas.$get({
				query: personaType ? { persona_type: personaType } : undefined,
			});
			return unwrapApiResponse<PersonaListItem[]>(res);
		},
	});
}

export function usePersona(personaId: string | undefined | null) {
	return useQuery({
		queryKey: ["personas", personaId],
		queryFn: async () => {
			if (!personaId) throw new Error("Persona id required");
			const res = await client.api.personas[":personaId"].$get({
				param: { personaId },
			});
			return unwrapApiResponse(res);
		},
		enabled: Boolean(personaId),
	});
}

export function usePersonaSections(personaId: string | undefined | null) {
	return useQuery({
		queryKey: ["personas", personaId, "sections"],
		queryFn: async (): Promise<PersonaSection[]> => {
			if (!personaId) throw new Error("Persona id required");
			const res = await client.api.personas[":personaId"].sections.$get({
				param: { personaId },
			});
			return unwrapApiResponse<PersonaSection[]>(res);
		},
		enabled: Boolean(personaId),
	});
}

export function useUpdatePersonaSection(
	personaId: string | undefined | null,
	sectionId: string | undefined | null,
) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (content: string) => {
			if (!personaId || !sectionId)
				throw new Error("Persona and section required");
			const res = await client.api.personas[":personaId"].sections[
				":sectionId"
			].$put({
				param: { personaId, sectionId },
				json: { content },
			});
			return unwrapApiResponse(res);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["personas", personaId, "sections"],
			});
			queryClient.invalidateQueries({ queryKey: ["personas", personaId] });
		},
	});
}

export function useGenerateWingfoxPersona() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async () => {
			const res = await client.api.personas.wingfox.generate.$post();
			return unwrapApiResponse(res);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["personas"] });
		},
	});
}

export function useSetRandomPersonaIcon(personaId: string | undefined | null) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (): Promise<{ icon_url: string }> => {
			if (!personaId) throw new Error("Persona id required");
			const res = await client.api.personas[":personaId"].icon.$post({
				param: { personaId },
			});
			return unwrapApiResponse(res);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["personas"] });
			if (personaId) {
				queryClient.invalidateQueries({ queryKey: ["personas", personaId] });
			}
		},
	});
}
