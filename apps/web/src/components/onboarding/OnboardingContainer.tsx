import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";

const ONBOARDING_STEPS = [
	{ path: "/onboarding/profile", step: 1 },
	{ path: "/onboarding/quiz", step: 2 },
	{ path: "/onboarding/speed-dating", step: 3 },
	{ path: "/onboarding/review", step: 4 },
] as const;

interface OnboardingContainerProps {
	children: React.ReactNode;
	currentPath: string;
	/** プログレスバーを表示する（クイズなど） */
	showProgressBar?: boolean;
	/** 0〜1 の進捗。showProgressBar が true のとき使用 */
	progress?: number;
	/** ステップインジケーターを非表示にする */
	hideStepIndicator?: boolean;
	/** 最大幅。default: 520px */
	maxWidth?: "sm" | "md" | "lg";
	className?: string;
}

const maxWidthClass = {
	sm: "max-w-[480px]",
	md: "max-w-[520px]",
	lg: "max-w-2xl",
} as const;

export function OnboardingContainer({
	children,
	currentPath,
	showProgressBar = false,
	progress = 0,
	hideStepIndicator = false,
	maxWidth = "md",
	className,
}: OnboardingContainerProps) {
	const currentStepConfig = ONBOARDING_STEPS.find((s) =>
		currentPath.startsWith(s.path),
	);
	const currentStep = currentStepConfig?.step ?? 1;

	// speed-dating / review はコンテンツが広いため maxWidth を大きく
	const effectiveMaxWidth =
		currentPath.includes("speed-dating") || currentPath.includes("review")
			? "lg"
			: maxWidth;

	return (
		<div
			className={cn(
				"min-h-screen w-full flex flex-col items-center justify-center p-4 md:p-6 bg-background",
				className,
			)}
		>
			<div className={cn("w-full space-y-6", maxWidthClass[effectiveMaxWidth])}>
				{!hideStepIndicator && (
					<div className="flex items-center justify-center gap-2 pt-2">
						{ONBOARDING_STEPS.map(({ step, path }) => (
							<Link
								key={step}
								to={path}
								className={cn(
									"h-2 rounded-full transition-all duration-300 block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
									step <= currentStep ? "w-8 bg-secondary" : "w-2 bg-muted",
								)}
								aria-label={`Step ${step}`}
								title={`Step ${step}`}
							/>
						))}
					</div>
				)}
				{showProgressBar && (
					<div className="w-full h-2 rounded-full bg-muted overflow-hidden">
						<div
							className="h-full bg-secondary transition-all duration-300"
							style={{ width: `${Math.round(progress * 100)}%` }}
							aria-valuenow={Math.round(progress * 100)}
							aria-valuemin={0}
							aria-valuemax={100}
							role="progressbar"
							tabIndex={0}
						/>
					</div>
				)}
				{children}
			</div>
		</div>
	);
}

export function OnboardingStepLabel({
	step,
	total,
	className,
}: {
	step: number;
	total: number;
	className?: string;
}) {
	return (
		<p
			className={cn(
				"text-xs font-medium uppercase tracking-wider text-muted-foreground",
				className,
			)}
		>
			Step {step} of {total}
		</p>
	);
}
