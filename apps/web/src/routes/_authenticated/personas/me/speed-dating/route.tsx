import { ContentPending } from "@/components/route-pending";
import { OnboardingSpeedDating } from "@/routes/_authenticated/onboarding/speed-dating/-components/OnboardingSpeedDating";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
	"/_authenticated/personas/me/speed-dating",
)({
	pendingComponent: ContentPending,
	component: SpeedDatingEditPage,
});

function SpeedDatingEditPage() {
	return <OnboardingSpeedDating returnTo="/personas/me" />;
}
