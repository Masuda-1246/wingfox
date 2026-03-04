import { ContentPending } from "@/components/route-pending";
import { OnboardingQuiz } from "@/routes/_authenticated/onboarding/quiz/-components/OnboardingQuiz";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/personas/me/quiz")({
	pendingComponent: ContentPending,
	component: QuizEditPage,
});

function QuizEditPage() {
	return (
		<div className="min-h-screen w-full flex flex-col items-center justify-center p-4 md:p-6 bg-background">
			<div className="w-full max-w-[520px]">
				<OnboardingQuiz editMode />
			</div>
		</div>
	);
}
