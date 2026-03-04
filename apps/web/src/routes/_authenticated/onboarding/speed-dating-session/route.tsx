import { ContentPending } from "@/components/route-pending";
import { clearSpeedDatingSession } from "@/lib/speed-dating-session-storage";
import { SpeedDatingSessionPage } from "@/routes/_authenticated/onboarding/speed-dating/session/-components/SpeedDatingSessionPage";
import {
	type ErrorComponentProps,
	createFileRoute,
	useRouter,
} from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

function SpeedDatingSessionError({ reset }: ErrorComponentProps) {
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
					onClick={() => {
						clearSpeedDatingSession();
						router.navigate({ to: "/onboarding/speed-dating" });
					}}
					className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
				>
					<ArrowLeft className="w-4 h-4" />
					{t("speed_dating.error_route_back")}
				</button>
			</div>
		</div>
	);
}

export const Route = createFileRoute(
	"/_authenticated/onboarding/speed-dating-session",
)({
	validateSearch: (s): { returnTo?: string } => ({
		returnTo:
			typeof (s as { returnTo?: string }).returnTo === "string"
				? (s as { returnTo: string }).returnTo
				: undefined,
	}),
	pendingComponent: ContentPending,
	errorComponent: SpeedDatingSessionError,
	component: SpeedDatingSessionWrapper,
});

function SpeedDatingSessionWrapper() {
	const { returnTo } = Route.useSearch();
	return <SpeedDatingSessionPage returnTo={returnTo} />;
}
