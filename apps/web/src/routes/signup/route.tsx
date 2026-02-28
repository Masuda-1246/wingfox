import { FullPagePending } from "@/components/route-pending";
import { createFileRoute } from "@tanstack/react-router";
import { Signup } from "./-components/Signup";

export const Route = createFileRoute("/signup")({
	pendingComponent: FullPagePending,
	component: Signup,
});
