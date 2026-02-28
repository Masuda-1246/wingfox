import { createFileRoute } from "@tanstack/react-router";
import { OnboardingSpeedDating } from "./-components/OnboardingSpeedDating";

export const Route = createFileRoute("/_authenticated/onboarding/speed-dating")({
	component: OnboardingSpeedDating,
});
