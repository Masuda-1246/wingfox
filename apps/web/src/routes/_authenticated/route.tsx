import { supabase } from "@/lib/supabase";
import { FullPagePending } from "@/components/route-pending";
import { UpperHeader } from "@/components/layouts/UpperHeader";
import { Outlet, createFileRoute, redirect, useLocation } from "@tanstack/react-router";
import { queryClient } from "@/lib/query-client";
import { authMeQueryOptions } from "@/lib/hooks/useAuthMe";

/** オンボーディング未完了でもアクセス可能なパス（設定など） */
const ALLOWED_WITHOUT_ONBOARDING = ["/settings", "/speed-dating-standalone"] as const;

function isAllowedWithoutOnboarding(pathname: string): boolean {
	return ALLOWED_WITHOUT_ONBOARDING.some(
		(p) => pathname === p || pathname.startsWith(`${p}/`),
	);
}

export const Route = createFileRoute("/_authenticated")({
	pendingComponent: FullPagePending,
	beforeLoad: async ({ location }) => {
		const {
			data: { session },
		} = await supabase.auth.getSession();
		if (!session) {
			throw redirect({ to: "/login" });
		}
		const pathname =
			typeof window !== "undefined" ? window.location.pathname : (location?.pathname ?? "");
		let onboardingStatus = "not_started";
		let profileComplete = false;
		try {
			const me = await queryClient.ensureQueryData(authMeQueryOptions());
			onboardingStatus = me.onboarding_status ?? "not_started";
			const nickname = (me.nickname ?? "").toString().trim();
			const birthYear = me.birth_year;
			const gender = me.gender;
			profileComplete =
				nickname.length > 0 &&
				typeof birthYear === "number" &&
				birthYear >= 1900 &&
				birthYear <= 2100 &&
				(typeof gender === "string" ? gender.length > 0 : false);
		} catch {
			// keep default not_started, profileComplete false
		}
		const onOnboarding = pathname.startsWith("/onboarding");
		if (onboardingStatus === "confirmed") {
			if (onOnboarding && !pathname.startsWith("/onboarding/speed-dating")) {
				throw redirect({ to: "/personas/me" });
			}
			return;
		}
		// オンボーディング中は各セクションに戻れるようにリダイレクトしない
		if (!onOnboarding) {
			if (isAllowedWithoutOnboarding(pathname)) {
				return;
			}
			if (onboardingStatus === "not_started") {
				if (!profileComplete) {
					throw redirect({ to: "/onboarding/profile" });
				}
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
	const location = useLocation();
	const pathname = location.pathname;
	// ヘッダーを非表示にするのはプロフィール〜クイズまで。クイズ完了後は表示する。
	const hideHeader =
		pathname === "/onboarding" ||
		pathname === "/onboarding/profile" ||
		pathname.startsWith("/onboarding/quiz");

	return (
		<>
			{!hideHeader && <UpperHeader />}
			<Outlet />
		</>
	);
}
