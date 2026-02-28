import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/personas/quiz")({
	beforeLoad: () => {
		throw redirect({ to: "/onboarding/quiz" });
	},
	component: () => null,
});
