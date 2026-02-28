import { createFileRoute } from "@tanstack/react-router";
import { PersonasMe } from "./-components/PersonasMe";

export const Route = createFileRoute("/_authenticated/personas/me")({
	component: PersonasMe,
});
