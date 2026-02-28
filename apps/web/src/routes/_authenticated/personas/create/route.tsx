import { createFileRoute } from "@tanstack/react-router";
import { PersonasCreate } from "./-components/PersonasCreate";

export const Route = createFileRoute("/_authenticated/personas/create")({
	component: PersonasCreate,
});
