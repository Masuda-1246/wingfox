import { ContentPending } from "@/components/route-pending";
import { createFileRoute } from "@tanstack/react-router";
import { OnboardingSpeedDating } from "./-components/OnboardingSpeedDating";

export const Route = createFileRoute("/_authenticated/onboarding/speed-dating")(
	{
		pendingComponent: ContentPending,
		component: OnboardingSpeedDating,
	},
);
