import { ContentPending } from "@/components/route-pending";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

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
	component: SpeedDatingCompletePage,
});
