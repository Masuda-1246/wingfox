import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAuthMe, useUpdateAuthMe } from "@/lib/hooks/useAuthMe";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

const GENDER_OPTIONS = [
	{ value: "male", labelKey: "gender_male" },
	{ value: "female", labelKey: "gender_female" },
	{ value: "other", labelKey: "gender_other" },
	{ value: "undisclosed", labelKey: "gender_undisclosed" },
] as const;

export function OnboardingProfile() {
	const { t } = useTranslation("onboarding");
	const navigate = useNavigate();
	const { data: authMe, isLoading: loadingMe } = useAuthMe();
	const updateAuthMe = useUpdateAuthMe();

	const [nickname, setNickname] = useState("");
	const [birthYear, setBirthYear] = useState("");
	const [gender, setGender] = useState<string>("");

	useEffect(() => {
		if (authMe) {
			setNickname(authMe.nickname ?? "");
			setBirthYear(
				authMe.birth_year != null ? String(authMe.birth_year) : "",
			);
			setGender(authMe.gender ?? "");
		}
	}, [authMe]);

	const handleSubmit = useCallback(async () => {
		const nicknameTrimmed = nickname.trim();
		if (!nicknameTrimmed) {
			toast.error(t("profile.error_nickname"));
			return;
		}
		const birthYearNum = birthYear.trim()
			? Number(birthYear.trim())
			: null;
		if (
			birthYearNum != null &&
			(Number.isNaN(birthYearNum) ||
				birthYearNum < 1900 ||
				birthYearNum > 2100)
		) {
			toast.error(t("profile.error_birth_year"));
			return;
		}
		if (!gender) {
			toast.error(t("profile.error_gender"));
			return;
		}
		const genderValue = gender as
			| "male"
			| "female"
			| "other"
			| "undisclosed";
		try {
			await updateAuthMe.mutateAsync({
				nickname: nicknameTrimmed,
				birth_year: birthYearNum,
				gender: genderValue,
			});
			toast.success(t("profile.submit_success"));
			navigate({ to: "/onboarding/quiz" });
		} catch (err) {
			console.error(err);
			toast.error(t("profile.submit_error"));
		}
	}, [
		nickname,
		birthYear,
		gender,
		updateAuthMe,
		t,
		navigate,
	]);

	if (loadingMe) {
		return (
			<div className="flex h-64 items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="p-4 md:p-6 w-full max-w-2xl mx-auto space-y-6 pb-20">
			<Card>
				<CardHeader>
					<CardTitle>{t("profile.title")}</CardTitle>
					<CardDescription>{t("profile.description")}</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					<div className="space-y-2">
						<label
							htmlFor="onboarding-nickname"
							className={cn(
								"text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
							)}
						>
							{t("profile.nickname")}
						</label>
						<input
							id="onboarding-nickname"
							value={nickname}
							onChange={(e) => setNickname(e.target.value)}
							placeholder={t("profile.nickname_placeholder")}
							autoComplete="nickname"
							className={cn(
								"flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
							)}
						/>
					</div>
					<div className="space-y-2">
						<label
							htmlFor="onboarding-birth-year"
							className={cn(
								"text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
							)}
						>
							{t("profile.birth_year")}
						</label>
						<input
							id="onboarding-birth-year"
							type="number"
							min={1900}
							max={2100}
							value={birthYear}
							onChange={(e) => setBirthYear(e.target.value)}
							placeholder={t("profile.birth_year_placeholder")}
							className={cn(
								"flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
							)}
						/>
					</div>
					<div className="space-y-2">
						<label
							htmlFor="onboarding-gender"
							className={cn(
								"text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
							)}
						>
							{t("profile.gender")}
						</label>
						<select
							id="onboarding-gender"
							value={gender}
							onChange={(e) => setGender(e.target.value)}
							className={cn(
								"flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
							)}
						>
							<option value="">{t("profile.gender_select")}</option>
							{GENDER_OPTIONS.map((opt) => (
								<option key={opt.value} value={opt.value}>
									{t(`profile.${opt.labelKey}`)}
								</option>
							))}
						</select>
					</div>
					<Button
						onClick={handleSubmit}
						disabled={updateAuthMe.isPending}
						className="w-full gap-2"
					>
						{updateAuthMe.isPending ? (
							<Loader2 className="size-4 animate-spin" />
						) : null}
						{t("profile.submit")}
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
