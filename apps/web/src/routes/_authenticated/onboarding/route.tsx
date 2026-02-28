import { Outlet, createFileRoute, useLocation } from "@tanstack/react-router";
import { OnboardingContainer } from "@/components/onboarding/OnboardingContainer";

export const Route = createFileRoute("/_authenticated/onboarding")({
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
