import { ContentPending } from "@/components/route-pending";
import { SpeedDatingSessionPage } from "@/routes/_authenticated/onboarding/speed-dating/session/-components/SpeedDatingSessionPage";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
	"/_authenticated/onboarding/speed-dating-session",
)({
	validateSearch: (s): { returnTo?: string } => ({
		returnTo:
			typeof (s as { returnTo?: string }).returnTo === "string"
				? (s as { returnTo: string }).returnTo
				: undefined,
	}),
	pendingComponent: ContentPending,
	component: SpeedDatingSessionWrapper,
});

function SpeedDatingSessionWrapper() {
	const { returnTo } = Route.useSearch();
	return <SpeedDatingSessionPage returnTo={returnTo} />;
}
