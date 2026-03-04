import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/personas/create")({
	beforeLoad: () => {
		throw redirect({ to: "/personas/me/speed-dating" });
	},
	component: () => null,
});
