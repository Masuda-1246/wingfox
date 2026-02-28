import { OnboardingProfile } from "./-components/OnboardingProfile";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/onboarding/profile")({
	component: OnboardingProfile,
});
