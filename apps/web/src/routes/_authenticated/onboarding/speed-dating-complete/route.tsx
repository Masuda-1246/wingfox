import { ContentPending } from "@/components/route-pending";
import {
	type ErrorComponentProps,
	createFileRoute,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import {
	AlertTriangle,
	ArrowRight,
	ChevronRight,
	RefreshCw,
} from "lucide-react";
import { useTranslation } from "react-i18next";

function SpeedDatingCompleteError({ reset }: ErrorComponentProps) {
	const { t } = useTranslation("onboarding");
	const router = useRouter();

	return (
		<div className="p-4 md:p-6 w-full max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[50vh] space-y-6">
			<div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
				<AlertTriangle className="w-8 h-8 text-destructive" />
			</div>
			<h3 className="text-xl font-bold text-destructive">
				{t("speed_dating.error_route_title")}
			</h3>
			<p className="text-sm text-muted-foreground text-center max-w-md">
				{t("speed_dating.error_route_desc")}
			</p>
			<div className="flex gap-3">
				<button
					type="button"
					onClick={reset}
					className="inline-flex items-center gap-2 rounded-full bg-secondary px-5 py-2.5 text-sm font-medium text-secondary-foreground hover:opacity-90 transition-colors"
				>
					<RefreshCw className="w-4 h-4" />
					{t("speed_dating.error_route_reload")}
				</button>
				<button
					type="button"
					onClick={() => router.navigate({ to: "/onboarding/review" })}
					className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
				>
					<ArrowRight className="w-4 h-4" />
					{t("speed_dating.skip_to_review")}
				</button>
			</div>
		</div>
	);
}

function SpeedDatingCompletePage() {
	const { t } = useTranslation("onboarding");
	const navigate = useNavigate();

	return (
		<div className="p-4 md:p-6 min-h-full w-full max-w-7xl mx-auto flex flex-col">
			<div className="max-w-4xl mx-auto flex flex-col gap-8 py-12 flex-1 justify-center">
				<div className="space-y-3">
					<h2 className="text-3xl md:text-4xl font-black tracking-tight text-foreground">
						{t("speed_dating.session_complete_title")}
					</h2>
					<p className="text-muted-foreground">
						{t("speed_dating.session_complete_desc")}
					</p>
				</div>

				<button
					type="button"
					onClick={() => navigate({ to: "/onboarding/review" })}
					className="px-8 py-4 bg-secondary text-secondary-foreground rounded-full font-bold text-sm tracking-wide hover:bg-secondary/90 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 shadow-md shadow-secondary/20 shrink-0 w-fit"
				>
					{t("speed_dating.finalize_persona")}
					<ChevronRight className="w-4 h-4" />
				</button>
			</div>
		</div>
	);
}

export const Route = createFileRoute(
	"/_authenticated/onboarding/speed-dating-complete",
)({
	pendingComponent: ContentPending,
	errorComponent: SpeedDatingCompleteError,
	component: SpeedDatingCompletePage,
});
