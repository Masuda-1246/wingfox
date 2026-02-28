import { createFileRoute } from "@tanstack/react-router";
import { FullPagePending } from "@/components/route-pending";
import { Register } from "./-components/Register";

export const Route = createFileRoute("/register")({
	pendingComponent: FullPagePending,
	component: Register,
});
