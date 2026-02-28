import { Outlet, createFileRoute, useLocation } from "@tanstack/react-router";
import { ContentPending } from "@/components/route-pending";
import { OnboardingContainer } from "@/components/onboarding/OnboardingContainer";

export const Route = createFileRoute("/_authenticated/onboarding")({
	pendingComponent: ContentPending,
	component: OnboardingLayout,
});

function OnboardingLayout() {
	const location = useLocation();
	const pathname = location.pathname;

	return (
		<OnboardingContainer currentPath={pathname}>
			<Outlet />
		</OnboardingContainer>
	);
}
