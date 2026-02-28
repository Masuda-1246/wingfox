import { ContentPending } from "@/components/route-pending";
import { SpeedDatingSessionPage } from "@/routes/_authenticated/onboarding/speed-dating/session/-components/SpeedDatingSessionPage";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
	"/_authenticated/onboarding/speed-dating-session",
)({
	pendingComponent: ContentPending,
	component: SpeedDatingSessionPage,
});
