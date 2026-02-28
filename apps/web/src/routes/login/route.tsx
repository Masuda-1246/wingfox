import { createFileRoute } from "@tanstack/react-router";
import { FullPagePending } from "@/components/route-pending";
import { Login } from "./-components/Login";

export const Route = createFileRoute("/login")({
	pendingComponent: FullPagePending,
	component: Login,
});
