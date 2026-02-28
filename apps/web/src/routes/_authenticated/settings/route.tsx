import { ContentPending } from "@/components/route-pending";
import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "./-components/Settings";

export const Route = createFileRoute("/_authenticated/settings")({
	pendingComponent: ContentPending,
	component: Settings,
});
