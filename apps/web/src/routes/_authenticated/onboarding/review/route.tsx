import { ContentPending } from "@/components/route-pending";
import { createFileRoute } from "@tanstack/react-router";
import { OnboardingReview } from "./-components/OnboardingReview";

export const Route = createFileRoute("/_authenticated/onboarding/review")({
	pendingComponent: ContentPending,
	component: OnboardingReview,
});
