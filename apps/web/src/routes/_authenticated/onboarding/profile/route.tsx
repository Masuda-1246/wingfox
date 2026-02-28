import { ContentPending } from "@/components/route-pending";
import { createFileRoute } from "@tanstack/react-router";
import { OnboardingProfile } from "./-components/OnboardingProfile";

export const Route = createFileRoute("/_authenticated/onboarding/profile")({
	pendingComponent: ContentPending,
	component: OnboardingProfile,
});
