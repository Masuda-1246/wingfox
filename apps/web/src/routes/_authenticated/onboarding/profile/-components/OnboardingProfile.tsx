import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OnboardingStepLabel } from "@/components/onboarding/OnboardingContainer";
import { useAuthMe, useUpdateAuthMe } from "@/lib/hooks/useAuthMe";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
	const [errors, setErrors] = useState({
		nickname: "",
		birthYear: "",
		gender: "",
	});
	const nicknameRef = useRef<HTMLInputElement>(null);

	// DBに既存データがある場合やセクションに戻ったときに表示
	useEffect(() => {
		if (authMe) {
			setNickname(authMe.nickname ?? "");
			setBirthYear(
				authMe.birth_year != null ? String(authMe.birth_year) : "",
			);
			setGender(authMe.gender ?? "");
		}
	}, [authMe]);

	// Auto-focus first input on mount
	useEffect(() => {
		if (nicknameRef.current) {
			nicknameRef.current.focus();
		}
	}, []);

	const validateForm = useCallback(() => {
		const newErrors = { nickname: "", birthYear: "", gender: "" };
		let isValid = true;

		// Nickname validation
		const nicknameTrimmed = nickname.trim();
		if (!nicknameTrimmed) {
			newErrors.nickname = t("profile.error_nickname");
			isValid = false;
		} else if (nicknameTrimmed.length > 50) {
			newErrors.nickname = t("profile.error_nickname_too_long");
			isValid = false;
		}

		// Birth year validation
		const birthYearTrimmed = birthYear.trim();
		if (birthYearTrimmed && birthYearTrimmed !== "") {
			const birthYearNum = Number(birthYearTrimmed);
			if (Number.isNaN(birthYearNum)) {
				newErrors.birthYear = t("profile.error_birth_year_invalid");
				isValid = false;
			} else if (birthYearNum < 1900 || birthYearNum > 2100) {
				newErrors.birthYear = t("profile.error_birth_year_range");
				isValid = false;
			}
		}

		// Gender validation
		if (!gender) {
			newErrors.gender = t("profile.error_gender");
			isValid = false;
		}

		setErrors(newErrors);
		return isValid;
	}, [nickname, birthYear, gender, t]);

	const handleSubmit = useCallback(async () => {
		if (!validateForm()) {
			return;
		}

		const nicknameTrimmed = nickname.trim();
		const birthYearNum = birthYear.trim() ? Number(birthYear.trim()) : null;
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
		validateForm,
	]);

	if (loadingMe) {
		return (
			<div className="flex min-h-[320px] items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="rounded-2xl border border-border bg-card p-8 md:p-10 shadow-sm">
			<div className="space-y-6">
				<div className="space-y-1">
					<OnboardingStepLabel step={1} total={4} />
					<h2 className="text-2xl font-bold tracking-tight">
						{t("profile.title")}
					</h2>
					<p className="text-sm text-muted-foreground">
						{t("profile.description")}
					</p>
				</div>

				<div className="space-y-5">
					<div className="space-y-2">
						<label
							htmlFor="onboarding-nickname"
							className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
						>
							{t("profile.nickname")}
						</label>
						<Input
							id="onboarding-nickname"
							ref={nicknameRef}
							value={nickname}
							onChange={(e) => {
								setNickname(e.target.value);
								if (errors.nickname) {
									setErrors((prev) => ({ ...prev, nickname: "" }));
								}
							}}
							placeholder={t("profile.nickname_placeholder")}
							autoComplete="nickname"
							className={cn("rounded-lg", errors.nickname && "border-destructive")}
						/>
						{errors.nickname && (
							<p className="text-sm text-destructive">{errors.nickname}</p>
						)}
					</div>
					<div className="space-y-2">
						<label
							htmlFor="onboarding-birth-year"
							className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
						>
							{t("profile.birth_year")}
						</label>
						<Input
							id="onboarding-birth-year"
							type="number"
							min={1900}
							max={2100}
							value={birthYear}
							onChange={(e) => {
								setBirthYear(e.target.value);
								if (errors.birthYear) {
									setErrors((prev) => ({ ...prev, birthYear: "" }));
								}
							}}
							placeholder={t("profile.birth_year_placeholder")}
							className={cn("rounded-lg", errors.birthYear && "border-destructive")}
						/>
						{errors.birthYear && (
							<p className="text-sm text-destructive">{errors.birthYear}</p>
						)}
					</div>
					<div className="space-y-2">
						<label
							htmlFor="onboarding-gender"
							className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
						>
							{t("profile.gender")}
						</label>
						<select
							id="onboarding-gender"
							value={gender}
							onChange={(e) => {
								setGender(e.target.value);
								if (errors.gender) {
									setErrors((prev) => ({ ...prev, gender: "" }));
								}
							}}
							className={cn(
								"flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
								errors.gender && "border-destructive",
							)}
						>
							<option value="">{t("profile.gender_select")}</option>
							{GENDER_OPTIONS.map((opt) => (
								<option key={opt.value} value={opt.value}>
									{t(`profile.${opt.labelKey}`)}
								</option>
							))}
						</select>
						{errors.gender && (
							<p className="text-sm text-destructive">{errors.gender}</p>
						)}
					</div>
				</div>

				<Button
					onClick={handleSubmit}
					disabled={updateAuthMe.isPending}
					className="w-full rounded-full gap-2"
					variant="secondary"
				>
					{updateAuthMe.isPending ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<>
							{t("profile.submit")}
							<ArrowRight className="size-4" />
						</>
					)}
				</Button>
			</div>
		</div>
	);
}
