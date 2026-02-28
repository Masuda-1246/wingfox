import { supabase } from "@/lib/supabase";
import { UpperHeader } from "@/components/layouts/UpperHeader";
import { Outlet, createFileRoute, redirect, useLocation } from "@tanstack/react-router";

/** オンボーディング未完了でもアクセス可能なパス（設定など） */
const ALLOWED_WITHOUT_ONBOARDING = ["/settings"] as const;

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
		let profileComplete = false;
		try {
			const res = await fetch(`${base}/api/auth/me`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			if (res.ok) {
				const json = (await res.json()) as {
					data?: {
						onboarding_status?: string;
						nickname?: string | null;
						birth_year?: number | null;
						gender?: string | null;
					};
				};
				const data = json.data;
				onboardingStatus = data?.onboarding_status ?? "not_started";
				const nickname = (data?.nickname ?? "").toString().trim();
				const birthYear = data?.birth_year;
				const gender = data?.gender;
				profileComplete =
					nickname.length > 0 &&
					typeof birthYear === "number" &&
					birthYear >= 1900 &&
					birthYear <= 2100 &&
					(typeof gender === "string" ? gender.length > 0 : false);
			}
		} catch {
			// keep default not_started, profileComplete false
		}
		const onOnboarding = pathname.startsWith("/onboarding");
		if (onboardingStatus === "confirmed") {
			if (onOnboarding) {
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
