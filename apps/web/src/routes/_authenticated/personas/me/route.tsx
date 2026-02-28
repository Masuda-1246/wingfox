import { createFileRoute } from "@tanstack/react-router";
import { ContentPending } from "@/components/route-pending";
import { PersonasMe } from "./-components/PersonasMe";
import { queryClient } from "@/lib/query-client";
import { client } from "@/api-client";
import { unwrapApiResponse } from "@/lib/api";
import type { PersonaListItem, ProfileMe } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/personas/me")({
	pendingComponent: ContentPending,
	component: PersonasMe,
	loader: async () => {
		// Prefetch all independent data in parallel before component mounts.
		// This eliminates the waterfall: personas list, profile, quiz questions, quiz answers
		// all start fetching at the same time instead of sequentially.
		await Promise.allSettled([
			queryClient.ensureQueryData({
				queryKey: ["personas", "list", "wingfox"],
				queryFn: async () => {
					const res = await client.api.personas.$get({ query: { persona_type: "wingfox" } });
					return unwrapApiResponse<PersonaListItem[]>(res);
				},
			}),
			queryClient.ensureQueryData({
				queryKey: ["profiles", "me"],
				queryFn: async () => {
					const res = await client.api.profiles.me.$get();
					return unwrapApiResponse<ProfileMe>(res);
				},
			}),
			queryClient.ensureQueryData({
				queryKey: ["quiz", "questions"],
				queryFn: async () => {
					const res = await client.api.quiz.questions.$get();
					return unwrapApiResponse(res);
				},
			}),
			queryClient.ensureQueryData({
				queryKey: ["quiz", "answers"],
				queryFn: async () => {
					const res = await client.api.quiz.answers.$get();
					return unwrapApiResponse(res);
				},
			}),
		]);

		// Now prefetch sections if we got a persona (second wave, but persona data is in cache)
		const personas = queryClient.getQueryData<PersonaListItem[]>(["personas", "list", "wingfox"]);
		const personaId = personas && personas.length > 0 ? personas[0].id : null;
		if (personaId) {
			await queryClient.ensureQueryData({
				queryKey: ["personas", personaId, "sections"],
				queryFn: async () => {
					const res = await client.api.personas[":personaId"].sections.$get({
						param: { personaId },
					});
					return unwrapApiResponse(res);
				},
			});
		}
	},
});
