import { createFileRoute } from "@tanstack/react-router";
import { ContentPending } from "@/components/route-pending";
import { PersonasMe } from "./-components/PersonasMe";

export const Route = createFileRoute("/_authenticated/personas/me")({
	pendingComponent: ContentPending,
	component: PersonasMe,
});
