import { FullPagePending } from "@/components/route-pending";
import { createFileRoute } from "@tanstack/react-router";
import { Login } from "./-components/Login";

export const Route = createFileRoute("/login")({
	pendingComponent: FullPagePending,
	component: Login,
});
