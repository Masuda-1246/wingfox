import { useAuthMe, useUpdateAuthMe } from "@/lib/hooks/useAuthMe";
import { useProfileMe, useUpdateProfileMe } from "@/lib/hooks/useProfile";
import { cn } from "@/lib/utils";
import { Globe, Languages, LogOut, Save, Trash2, User } from "lucide-react";
import { forwardRef, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

function Card({
	className,
	children,
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn(
				"rounded-2xl border border-border bg-card text-card-foreground overflow-hidden",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}

function Button({
	className,
	variant = "primary",
	size = "default",
	...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: "primary" | "secondary" | "destructive" | "ghost" | "outline";
	size?: "default" | "sm" | "icon";
}) {
	const variants = {
		primary: "bg-primary text-primary-foreground hover:opacity-90",
		secondary: "bg-secondary text-secondary-foreground hover:opacity-90",
		destructive: "bg-red-500 text-white hover:bg-red-600",
		ghost: "hover:bg-accent hover:text-accent-foreground",
		outline: "border border-input hover:bg-accent hover:text-accent-foreground",
	};
	const sizes = {
		default: "h-10 px-4 py-2",
		sm: "h-9 rounded-md px-3",
		icon: "h-10 w-10 flex items-center justify-center",
	};

	return (
		<button
			type="button"
			className={cn(
				"inline-flex items-center justify-center rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
				variants[variant],
				sizes[size],
				className,
			)}
			{...props}
		/>
	);
}

const Input = forwardRef<
	HTMLInputElement,
	React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
	return (
		<input
			className={cn(
				"flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			ref={ref}
			{...props}
		/>
	);
});
Input.displayName = "Input";

function Label({
	className,
	children,
	...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
	return (
		// biome-ignore lint/a11y/noLabelWithoutControl: htmlFor is passed via spread props
		<label
			className={cn(
				"text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
				className,
			)}
			{...props}
		>
			{children}
		</label>
	);
}

const Textarea = forwardRef<
	HTMLTextAreaElement,
	React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
	return (
		<textarea
			className={cn(
				"flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			ref={ref}
			{...props}
		/>
	);
});
Textarea.displayName = "Textarea";

function SectionHeader({
	icon: Icon,
	title,
	description,
}: {
	icon: React.ComponentType<{ className?: string }>;
	title: string;
	description: string;
}) {
	return (
		<div className="flex items-start gap-4 mb-6">
			<div className="p-2 rounded-xl bg-accent/50 text-foreground">
				<Icon className="w-5 h-5" />
			</div>
			<div>
				<h3 className="text-lg font-semibold tracking-tight">{title}</h3>
				<p className="text-sm text-muted-foreground mt-1">{description}</p>
			</div>
		</div>
	);
}

export function Settings() {
	const { t, i18n } = useTranslation("settings");
	const { data: profile, isLoading, error } = useProfileMe();
	useUpdateProfileMe();
	const { data: authMe } = useAuthMe();
	const updateAuthMe = useUpdateAuthMe();

	const [basicInfo, setBasicInfo] = useState({
		nickname: "",
		gender: "",
		birthYear: "",
	});

	useEffect(() => {
		if (authMe) {
			const genderMap: Record<string, string> = {
				male: "男性",
				female: "女性",
				other: "その他",
				undisclosed: "未回答",
			};
			setBasicInfo({
				nickname: authMe.nickname ?? "",
				gender: authMe.gender ? (genderMap[authMe.gender] ?? "") : "",
				birthYear: authMe.birth_year != null ? String(authMe.birth_year) : "",
			});
		}
	}, [authMe]);

	const handleSaveBasicInfo = async () => {
		const genderApiMap: Record<
			string,
			"male" | "female" | "other" | "undisclosed"
		> = {
			男性: "male",
			女性: "female",
			その他: "other",
			未回答: "undisclosed",
		};
		const gender = basicInfo.gender
			? (genderApiMap[basicInfo.gender] ?? "undisclosed")
			: "undisclosed";
		const birthYearNum = basicInfo.birthYear.trim()
			? Number(basicInfo.birthYear)
			: null;
		if (
			birthYearNum != null &&
			(Number.isNaN(birthYearNum) || birthYearNum < 1900 || birthYearNum > 2100)
		) {
			toast.error(t("save_error"));
			return;
		}
		try {
			await updateAuthMe.mutateAsync({
				nickname: basicInfo.nickname || undefined,
				gender,
				birth_year: birthYearNum,
			});
			toast.success(t("updated_toast"));
		} catch (err) {
			console.error(err);
			toast.error(t("save_error"));
		}
	};

	const handleDeleteAccount = async () => {
		if (confirm(t("delete_confirm"))) {
			toast.error("アカウント削除はサポートからお問い合わせください");
		}
	};

	if (isLoading || (profile === undefined && !error)) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
			</div>
		);
	}

	if (error) {
		return (
			<div className="p-4 md:p-6 max-w-7xl mx-auto">
				<p className="text-destructive">
					プロフィールの読み込みに失敗しました。
				</p>
			</div>
		);
	}

	return (
		<div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
			<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
				<div>
					<h1 className="text-3xl font-black tracking-tighter sm:text-4xl mb-2">
						{t("title")}
					</h1>
					<p className="text-muted-foreground text-sm max-w-lg">
						{t("description")}
					</p>
				</div>
			</div>

			<div className="max-w-3xl space-y-6">
				<Card className="p-6">
					<SectionHeader
						icon={User}
						title={t("basic_info_title")}
						description={t("basic_info_description")}
					/>
					<div className="grid gap-6 md:grid-cols-3">
						<div className="space-y-2">
							<Label htmlFor="nickname">{t("nickname")}</Label>
							<Input
								id="nickname"
								value={basicInfo.nickname}
								onChange={(e) =>
									setBasicInfo({ ...basicInfo, nickname: e.target.value })
								}
								placeholder={t("nickname_placeholder")}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="gender">{t("gender")}</Label>
							<select
								id="gender"
								value={basicInfo.gender}
								onChange={(e) =>
									setBasicInfo({ ...basicInfo, gender: e.target.value })
								}
								className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
							>
								<option value="">{t("gender_select")}</option>
								<option value="男性">{t("gender_male")}</option>
								<option value="女性">{t("gender_female")}</option>
								<option value="その他">{t("gender_other")}</option>
								<option value="未回答">未回答</option>
							</select>
						</div>
						<div className="space-y-2">
							<Label htmlFor="birth_year">{t("birth_year")}</Label>
							<Input
								id="birth_year"
								type="number"
								min={1900}
								max={2100}
								value={basicInfo.birthYear}
								onChange={(e) =>
									setBasicInfo({ ...basicInfo, birthYear: e.target.value })
								}
								placeholder={t("birth_year_placeholder")}
							/>
						</div>
					</div>
					<Button
						onClick={handleSaveBasicInfo}
						disabled={updateAuthMe.isPending}
						className="mt-4 gap-2"
					>
						<Save className="w-4 h-4" />
						{t("save")}
					</Button>
				</Card>

				<Card className="p-6">
					<SectionHeader
						icon={Languages}
						title={t("language_title")}
						description={t("language_description")}
					/>
					<div className="space-y-4 mt-4">
						{[
							{
								id: "ja",
								label: t("language_ja"),
							},
							{
								id: "en",
								label: t("language_en"),
							},
						].map((option) => (
							<button
								type="button"
								key={option.id}
								tabIndex={0}
								onClick={() => i18n.changeLanguage(option.id)}
								onKeyDown={(e) => {
									if (e.key === "Enter") i18n.changeLanguage(option.id);
								}}
								className={cn(
									"cursor-pointer flex items-center gap-3 p-3 rounded-xl border transition-all w-full text-left",
									i18n.language === option.id
										? "bg-primary/10 border-primary shadow-sm"
										: "bg-transparent border-transparent hover:bg-accent",
								)}
							>
								<Globe
									className={cn(
										"w-5 h-5",
										i18n.language === option.id
											? "text-primary"
											: "text-muted-foreground",
									)}
								/>
								<p className="text-sm font-medium">{option.label}</p>
							</button>
						))}
					</div>
				</Card>

				<Card className="p-6 border-red-200 bg-red-50/50">
					<div className="flex items-start gap-4">
						<div className="p-2 rounded-xl bg-red-100 text-red-600">
							<Trash2 className="w-5 h-5" />
						</div>
						<div className="flex-1">
							<h3 className="text-lg font-semibold tracking-tight text-red-600">
								{t("danger_zone")}
							</h3>
							<p className="text-sm text-muted-foreground mt-1">
								{t("danger_description")}
							</p>
							<div className="mt-6 flex flex-wrap gap-4">
								<Button variant="destructive" onClick={handleDeleteAccount}>
									{t("delete_account")}
								</Button>
								<Button variant="ghost" className="text-muted-foreground">
									<LogOut className="w-4 h-4 mr-2" />
									{t("logout")}
								</Button>
							</div>
						</div>
					</div>
				</Card>
			</div>
		</div>
	);
}
