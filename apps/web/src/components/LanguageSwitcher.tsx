import { useAuth } from "@/lib/auth";
import { useUpdateAuthMe } from "@/lib/hooks/useAuthMe";
import { cn } from "@/lib/utils";
import { Globe } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const LANGUAGES = [
	{ id: "ja" as const, labelKey: "language_ja" },
	{ id: "en" as const, labelKey: "language_en" },
] as const;

function isCurrentLanguage(current: string, optionId: string) {
	return current === optionId || (current ?? "").startsWith(`${optionId}-`);
}

export function LanguageSwitcher({ className }: { className?: string }) {
	const { t, i18n } = useTranslation("settings");
	const { user } = useAuth();
	const updateAuthMe = useUpdateAuthMe();
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (ref.current && !ref.current.contains(event.target as Node)) {
				setOpen(false);
			}
		}
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const handleLanguageChange = async (nextLang: "ja" | "en") => {
		if (isCurrentLanguage(i18n.language, nextLang)) {
			setOpen(false);
			return;
		}
		const prevLang = i18n.language;
		await i18n.changeLanguage(nextLang);
		setOpen(false);

		// Persist preference only when signed in.
		if (!user) return;
		try {
			await updateAuthMe.mutateAsync({ language: nextLang });
		} catch (err) {
			console.error(err);
			await i18n.changeLanguage(prevLang);
		}
	};

	return (
		<div ref={ref} className={cn("relative", className)}>
			<button
				type="button"
				onClick={() => setOpen(!open)}
				className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				aria-label={t("language_title")}
				aria-expanded={open}
				aria-haspopup="listbox"
			>
				<Globe className="h-5 w-5" />
			</button>

			{open && (
				<div
					role="listbox"
					aria-label={t("language_title")}
					className="absolute right-0 top-full z-50 mt-2 w-40 rounded-xl border border-border bg-card py-1 shadow-lg"
					tabIndex={0}
				>
					{LANGUAGES.map((option) => (
						<button
							key={option.id}
							role="option"
							aria-selected={isCurrentLanguage(i18n.language, option.id)}
							type="button"
							onClick={() => void handleLanguageChange(option.id)}
							className={cn(
								"flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
								isCurrentLanguage(i18n.language, option.id)
									? "bg-primary/10 font-medium text-primary"
									: "hover:bg-accent",
							)}
						>
							{t(option.labelKey)}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
