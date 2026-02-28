import { createFileRoute } from "@tanstack/react-router";
import { OnboardingQuiz } from "./-components/OnboardingQuiz";

export const Route = createFileRoute("/_authenticated/onboarding/quiz")({
	component: OnboardingQuiz,
});
