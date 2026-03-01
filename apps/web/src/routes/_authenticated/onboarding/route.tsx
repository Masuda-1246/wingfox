import { OnboardingContainer } from "@/components/onboarding/OnboardingContainer";
import { OnboardingErrorBoundary } from "@/components/onboarding/OnboardingErrorBoundary";
import { ContentPending } from "@/components/route-pending";
import { Outlet, createFileRoute, useLocation } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/onboarding")({
	pendingComponent: ContentPending,
	component: OnboardingLayout,
});

function OnboardingLayout() {
	const location = useLocation();
	const pathname = location.pathname;

	return (
		<OnboardingContainer currentPath={pathname}>
			<OnboardingErrorBoundary>
				<Outlet />
			</OnboardingErrorBoundary>
		</OnboardingContainer>
	);
}
