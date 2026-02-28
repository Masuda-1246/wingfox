import { createFileRoute } from "@tanstack/react-router";
import { OnboardingReview } from "./-components/OnboardingReview";

export const Route = createFileRoute("/_authenticated/onboarding/review")({
	component: OnboardingReview,
});
