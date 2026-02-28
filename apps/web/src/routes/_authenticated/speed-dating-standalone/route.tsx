import { ContentPending } from "@/components/route-pending";
import { createFileRoute } from "@tanstack/react-router";
import { SpeedDatingPage } from "./-components/SpeedDatingPage";

export const Route = createFileRoute("/_authenticated/speed-dating-standalone")(
	{
		pendingComponent: ContentPending,
		component: SpeedDatingPage,
	},
);
