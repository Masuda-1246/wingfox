import { Outlet, createFileRoute } from "@tanstack/react-router";
import { ContentPending } from "@/components/route-pending";

export const Route = createFileRoute("/_authenticated/onboarding")({
	pendingComponent: ContentPending,
	component: OnboardingLayout,
});

function OnboardingLayout() {
	return <Outlet />;
}
