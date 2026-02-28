import { formatDate } from "@/lib/date";
import { useReports } from "@/lib/hooks/useReports";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
	AlertTriangle,
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	ExternalLink,
	HelpCircle,
	History,
	Mail,
	MessageSquareWarning,
	Send,
	ShieldAlert,
} from "lucide-react";
import { forwardRef, useState } from "react";
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
	children,
	...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: "primary" | "secondary" | "ghost" | "destructive";
}) {
	const variants = {
		primary: "bg-secondary text-secondary-foreground hover:opacity-90",
		secondary: "bg-muted text-muted-foreground hover:bg-muted/80",
		ghost: "hover:bg-accent hover:text-accent-foreground",
		destructive: "bg-red-500 text-white hover:bg-red-600",
	};

	return (
		<button
			type="button"
			className={cn(
				"inline-flex items-center justify-center rounded-full text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2",
				variants[variant],
				className,
			)}
			{...props}
		>
			{children}
		</button>
	);
}

const Input = forwardRef<
	HTMLInputElement,
	React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
	return (
		<input
			className={cn(
				"flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			ref={ref}
			{...props}
		/>
	);
});
Input.displayName = "Input";

const Textarea = forwardRef<
	HTMLTextAreaElement,
	React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
	return (
		<textarea
			className={cn(
				"flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			ref={ref}
			{...props}
		/>
	);
});
Textarea.displayName = "Textarea";

const Label = forwardRef<
	HTMLLabelElement,
	React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
	// biome-ignore lint/a11y/noLabelWithoutControl: htmlFor is passed via spread props
	<label
		ref={ref}
		className={cn(
			"text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
			className,
		)}
		{...props}
	/>
));
Label.displayName = "Label";

function ReportFormSection({
	onSubmit,
	isSubmitting,
}: {
	onSubmit: (data: Record<string, string>) => void;
	isSubmitting: boolean;
}) {
	const { t } = useTranslation("reports");
	const [targetId, setTargetId] = useState("");
	const [reason, setReason] = useState("offensive_language");
	const [details, setDetails] = useState("");

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!targetId || !details) {
			toast.error(t("required_error"));
			return;
		}
		onSubmit({ target_persona_id: targetId, reason, details });
		setTargetId("");
		setDetails("");
		setReason("offensive_language");
	};

	return (
		<Card className="col-span-12 md:col-span-7 p-6 flex flex-col gap-6 h-full">
			<div className="space-y-2">
				<div className="flex items-center gap-2 text-secondary">
					<ShieldAlert className="w-5 h-5" />
					<h2 className="text-lg font-bold tracking-tight">
						{t("report_title")}
					</h2>
				</div>
				<p className="text-muted-foreground text-sm">
					{t("report_description")}
					<br />
					{t("report_description_2")}
				</p>
			</div>

			<form onSubmit={handleSubmit} className="space-y-4 flex-1">
				<div className="space-y-2">
					<Label htmlFor="target-id">{t("target_label")}</Label>
					<Input
						id="target-id"
						placeholder={t("target_placeholder")}
						value={targetId}
						onChange={(e) => setTargetId(e.target.value)}
					/>
				</div>

				<div className="space-y-2">
					<Label htmlFor="reason">{t("reason_label")}</Label>
					<div className="relative">
						<select
							id="reason"
							className="flex h-10 w-full appearance-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
							value={reason}
							onChange={(e) => setReason(e.target.value)}
						>
							<option value="offensive_language">
								{t("reason_offensive")}
							</option>
							<option value="spam">{t("reason_spam")}</option>
							<option value="harassment">{t("reason_harassment")}</option>
							<option value="privacy">{t("reason_privacy")}</option>
							<option value="other">{t("reason_other")}</option>
						</select>
						<ChevronDown className="absolute right-3 top-3 h-4 w-4 opacity-50 pointer-events-none" />
					</div>
				</div>

				<div className="space-y-2">
					<Label htmlFor="details">{t("details_label")}</Label>
					<Textarea
						id="details"
						placeholder={t("details_placeholder")}
						className="min-h-[120px] resize-none"
						value={details}
						onChange={(e) => setDetails(e.target.value)}
					/>
				</div>

				<div className="pt-2">
					<Button
						type="submit"
						className="w-full md:w-auto gap-2"
						disabled={isSubmitting}
					>
						<Send className="w-4 h-4" />
						{isSubmitting ? t("submitting") : t("submit")}
					</Button>
				</div>
			</form>
		</Card>
	);
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<div className="border-b border-border last:border-0">
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="flex w-full items-center justify-between py-4 text-left font-medium transition-all hover:text-secondary"
			>
				<span className="text-sm">{question}</span>
				<ChevronRight
					className={cn(
						"h-4 w-4 transition-transform duration-200",
						isOpen && "rotate-90",
					)}
				/>
			</button>
			<AnimatePresence>
				{isOpen && (
					<motion.div
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: "auto", opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						className="overflow-hidden"
					>
						<div className="pb-4 text-sm text-muted-foreground leading-relaxed">
							{answer}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}

function FaqSection() {
	const { t } = useTranslation("reports");
	const faqs = [
		{
			question: t("faq_q1"),
			answer: t("faq_a1"),
		},
		{
			question: t("faq_q2"),
			answer: t("faq_a2"),
		},
		{
			question: t("faq_q3"),
			answer: t("faq_a3"),
		},
	];

	return (
		<Card className="col-span-12 md:col-span-5 p-6 h-full flex flex-col">
			<div className="flex items-center gap-2 mb-4 text-secondary">
				<HelpCircle className="w-5 h-5" />
				<h2 className="text-lg font-bold tracking-tight">{t("faq_title")}</h2>
			</div>
			<div className="flex-1">
				{faqs.map((faq) => (
					<FaqItem key={faq.question} {...faq} />
				))}
			</div>
			<div className="mt-6 pt-6 border-t border-border">
				<div className="rounded-lg bg-muted/50 p-4">
					<h4 className="font-medium text-sm mb-2 flex items-center gap-2">
						<Mail className="w-4 h-4" />
						{t("support_title")}
					</h4>
					<p className="text-xs text-muted-foreground mb-3">
						{t("support_description")}
					</p>
					<a
						href="mailto:support@foxxmatch.com"
						className="text-xs font-medium text-secondary hover:underline flex items-center gap-1"
					>
						support@foxxmatch.com <ExternalLink className="w-3 h-3" />
					</a>
				</div>
			</div>
		</Card>
	);
}

function HistorySection({
	reports,
}: { reports: Array<Record<string, unknown>> }) {
	const { t } = useTranslation("reports");
	return (
		<Card className="col-span-12 p-6">
			<div className="flex items-center justify-between mb-6">
				<div className="flex items-center gap-2">
					<History className="w-5 h-5 text-muted-foreground" />
					<h2 className="text-lg font-bold tracking-tight">
						{t("history_title")}
					</h2>
				</div>
				<span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded-full">
					Total: {reports.length}
				</span>
			</div>

			<div className="overflow-x-auto">
				{reports.length === 0 ? (
					<div className="text-center py-12 text-muted-foreground text-sm">
						{t("no_reports")}
					</div>
				) : (
					<table className="w-full text-sm text-left">
						<thead className="text-xs text-muted-foreground uppercase bg-muted/30">
							<tr>
								<th className="px-4 py-3 rounded-l-lg">ID</th>
								<th className="px-4 py-3">Date</th>
								<th className="px-4 py-3">Reason</th>
								<th className="px-4 py-3">Target</th>
								<th className="px-4 py-3 rounded-r-lg">Status</th>
							</tr>
						</thead>
						<tbody>
							{reports.map((report) => (
								<tr
									key={report.id as string}
									className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
								>
									<td className="px-4 py-3 font-mono text-xs">
										{report.id as string}
									</td>
									<td className="px-4 py-3 text-muted-foreground">
										{report.created_at instanceof Date
											? formatDate(report.created_at as Date)
											: String(report.created_at)}
									</td>
									<td className="px-4 py-3 font-medium">
										<span className="inline-flex items-center gap-1.5">
											<MessageSquareWarning className="w-3 h-3 text-orange-500" />
											{report.reason as string}
										</span>
									</td>
									<td className="px-4 py-3 text-muted-foreground">
										{(report.target_persona_id as string) || "-"}
									</td>
									<td className="px-4 py-3">
										<span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
											<CheckCircle2 className="w-3 h-3" />
											Received
										</span>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>
		</Card>
	);
}

function HeroCard() {
	const { t } = useTranslation("reports");
	return (
		<Card className="col-span-12 bg-gradient-to-r from-zinc-900 to-zinc-800 text-white p-8 md:p-10 relative overflow-hidden border-none">
			<div className="absolute top-0 right-0 w-64 h-64 bg-secondary/20 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
			<div className="relative z-10 max-w-2xl">
				<div className="flex items-center gap-2 mb-4 text-secondary">
					<AlertTriangle className="w-6 h-6" />
					<span className="text-sm font-bold tracking-wider uppercase">
						{t("hero_badge")}
					</span>
				</div>
				<h1 className="text-3xl md:text-5xl font-black tracking-tight mb-4 leading-tight">
					{t("hero_title_1")}
					<br />
					{t("hero_title_2")}
				</h1>
				<p className="text-zinc-300 text-base md:text-lg leading-relaxed max-w-lg">
					{t("hero_description")}
				</p>
			</div>
		</Card>
	);
}

export function Reports() {
	const { t } = useTranslation("reports");
	const { reports, isLoading, add } = useReports();

	const handleReportSubmit = async (data: Record<string, string>) => {
		try {
			await add({
				id: `rep-${Math.random().toString(36).substr(2, 9)}`,
				reporter_user_id: "current-user",
				target_persona_id: data.target_persona_id,
				reason: data.reason,
				created_at: new Date(),
			});
			toast.success(t("submit_success"), {
				description: t("submit_success_desc"),
			});
		} catch (error) {
			toast.error(t("submit_error"));
		}
	};

	return (
		<div className="p-4 md:p-6 w-full max-w-7xl mx-auto space-y-6">
			<div className="grid grid-cols-12 gap-6">
				<HeroCard />
				<ReportFormSection
					onSubmit={handleReportSubmit}
					isSubmitting={isLoading}
				/>
				<FaqSection />
				<HistorySection
					reports={reports as unknown as Array<Record<string, unknown>>}
				/>
			</div>

			<div className="text-center py-8">
				<p className="text-xs text-muted-foreground">
					{t("privacy_notice")}
					<span className="underline">{t("privacy_policy")}</span>
					{t("privacy_notice_suffix")}
				</p>
			</div>
		</div>
	);
}
