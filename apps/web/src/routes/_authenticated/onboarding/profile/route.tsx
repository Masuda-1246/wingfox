import { OnboardingProfile } from "./-components/OnboardingProfile";
import { createFileRoute } from "@tanstack/react-router";
import { ContentPending } from "@/components/route-pending";

export const Route = createFileRoute("/_authenticated/onboarding/profile")({
	pendingComponent: ContentPending,
	component: OnboardingProfile,
});
