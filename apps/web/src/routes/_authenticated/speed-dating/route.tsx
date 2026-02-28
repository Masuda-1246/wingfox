import { createFileRoute } from "@tanstack/react-router";
import { ContentPending } from "@/components/route-pending";
import { SpeedDatingPage } from "./-components/SpeedDatingPage";

export const Route = createFileRoute("/_authenticated/speed-dating" as any)({
	pendingComponent: ContentPending,
	component: SpeedDatingPage,
});
