import { supabase } from "@/lib/supabase";
import { UpperHeader } from "@/components/layouts/UpperHeader";
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

const ONBOARDING_PATHS = ["/onboarding/quiz", "/onboarding/speed-dating", "/onboarding/review"] as const;

/** オンボーディング未完了でもアクセス可能なパス（設定など） */
const ALLOWED_WITHOUT_ONBOARDING = ["/settings"] as const;

function isOnboardingPath(pathname: string): boolean {
	return ONBOARDING_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isAllowedWithoutOnboarding(pathname: string): boolean {
	return ALLOWED_WITHOUT_ONBOARDING.some(
		(p) => pathname === p || pathname.startsWith(`${p}/`),
	);
}

export const Route = createFileRoute("/_authenticated")({
	beforeLoad: async ({ location }) => {
		const {
			data: { session },
		} = await supabase.auth.getSession();
		if (!session) {
			throw redirect({ to: "/login" });
		}
		const pathname =
			typeof window !== "undefined" ? window.location.pathname : (location?.pathname ?? "");
		const token = session.access_token;
		const base = typeof window !== "undefined" ? window.location.origin : "";
		let onboardingStatus = "not_started";
		try {
			const res = await fetch(`${base}/api/auth/me`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			if (res.ok) {
				const json = (await res.json()) as { data?: { onboarding_status?: string } };
				onboardingStatus = json.data?.onboarding_status ?? "not_started";
			}
		} catch {
			// keep default not_started
		}
		const onOnboarding = pathname.startsWith("/onboarding");
		if (onboardingStatus === "confirmed") {
			if (onOnboarding) {
				throw redirect({ to: "/personas/me" });
			}
			return;
		}
		if (!onOnboarding) {
			if (isAllowedWithoutOnboarding(pathname)) {
				return;
			}
			if (onboardingStatus === "not_started") {
				throw redirect({ to: "/onboarding/quiz" });
			}
			if (onboardingStatus === "quiz_completed") {
				throw redirect({ to: "/onboarding/speed-dating" });
			}
			if (
				onboardingStatus === "speed_dating_completed" ||
				onboardingStatus === "profile_generated" ||
				onboardingStatus === "persona_generated"
			) {
				throw redirect({ to: "/onboarding/review" });
			}
		}
	},
	component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
	return (
		<>
			<UpperHeader />
			<Outlet />
		</>
	);
}
