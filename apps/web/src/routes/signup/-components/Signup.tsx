import { UpperHeader } from "@/components/layouts/UpperHeader";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { forwardRef, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: "primary" | "secondary" | "outline" | "ghost";
	size?: "sm" | "default" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant = "primary", size = "default", ...props }, ref) => {
		const variants = {
			primary: "bg-primary text-primary-foreground hover:opacity-90",
			secondary: "bg-secondary text-secondary-foreground hover:opacity-90",
			outline:
				"border border-input bg-background hover:bg-accent hover:text-accent-foreground",
			ghost: "hover:bg-accent hover:text-accent-foreground",
		};

		const sizes = {
			sm: "h-9 px-3 text-xs",
			default: "h-10 px-4 py-2",
			lg: "h-12 px-8 text-base",
		};

		return (
			<button
				ref={ref}
				className={cn(
					"inline-flex items-center justify-center rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
					variants[variant],
					sizes[size],
					className,
				)}
				{...props}
			/>
		);
	},
);
Button.displayName = "Button";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
	error?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
	({ className, error, ...props }, ref) => {
		return (
			<input
				ref={ref}
				className={cn(
					"flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
					error && "border-red-500 focus-visible:ring-red-500",
					className,
				)}
				{...props}
			/>
		);
	},
);
Input.displayName = "Input";

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

export function Signup() {
	const { t } = useTranslation("auth");
	const navigate = useNavigate();
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const [loading, setLoading] = useState(false);

	const [formData, setFormData] = useState({
		email: "",
		password: "",
		confirmPassword: "",
	});

	const [errors, setErrors] = useState({
		email: "",
		password: "",
		confirmPassword: "",
	});

	useEffect(() => {
		const isAuth = localStorage.getItem("isAuthenticated");
		if (isAuth === "true") {
			navigate({ to: "/" });
		}
	}, [navigate]);

	const validateForm = () => {
		let isValid = true;
		const newErrors = { email: "", password: "", confirmPassword: "" };

		if (!formData.email.trim()) {
			newErrors.email = t("signup.error_email_required");
			isValid = false;
		} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
			newErrors.email = t("signup.error_email_invalid");
			isValid = false;
		}

		if (!formData.password) {
			newErrors.password = t("signup.error_password_required");
			isValid = false;
		}

		if (!formData.confirmPassword) {
			newErrors.confirmPassword = t("signup.error_confirm_required");
			isValid = false;
		} else if (formData.password !== formData.confirmPassword) {
			newErrors.confirmPassword = t("signup.error_password_mismatch");
			isValid = false;
		}

		setErrors(newErrors);
		return isValid;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!validateForm()) {
			return;
		}

		setLoading(true);

		setTimeout(() => {
			localStorage.setItem("isAuthenticated", "true");
			toast.success(t("signup.welcome_toast"), {
				description: t("signup.welcome_description"),
			});

			setLoading(false);
			navigate({ to: "/" });
		}, 1000);
	};

	return (
		<>
			<UpperHeader />
			<div className="p-4 md:p-6 w-full h-full flex flex-col items-center justify-center">
				<div className="w-full max-w-[480px] space-y-8 p-8 md:p-12 rounded-2xl border border-border bg-card">
					<div className="space-y-2 text-center">
						<h2 className="text-2xl md:text-3xl font-black tracking-tighter uppercase">
							{t("signup.title")}
						</h2>
						<p className="text-sm text-muted-foreground">
							{t("signup.subtitle")}
						</p>
					</div>

					<form onSubmit={handleSubmit} className="space-y-6">
						<div className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="email">{t("signup.email_label")}</Label>
								<Input
									id="email"
									placeholder="name@example.com"
									type="email"
									autoCapitalize="none"
									autoComplete="email"
									autoCorrect="off"
									disabled={loading}
									value={formData.email}
									onChange={(e) => {
										setFormData({
											...formData,
											email: e.target.value,
										});
										if (errors.email) setErrors({ ...errors, email: "" });
									}}
									error={!!errors.email}
								/>
								{errors.email && (
									<p className="text-xs text-red-500 font-medium">
										{errors.email}
									</p>
								)}
							</div>

							<div className="space-y-2">
								<Label htmlFor="password">{t("signup.password_label")}</Label>
								<div className="relative">
									<Input
										id="password"
										placeholder="••••••••"
										type={showPassword ? "text" : "password"}
										autoComplete="new-password"
										disabled={loading}
										value={formData.password}
										onChange={(e) => {
											setFormData({
												...formData,
												password: e.target.value,
											});
											if (errors.password)
												setErrors({ ...errors, password: "" });
										}}
										error={!!errors.password}
										className="pr-10"
									/>
									<button
										type="button"
										onClick={() => setShowPassword(!showPassword)}
										className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
										tabIndex={-1}
									>
										{showPassword ? (
											<EyeOff className="h-4 w-4" />
										) : (
											<Eye className="h-4 w-4" />
										)}
									</button>
								</div>
								{errors.password && (
									<p className="text-xs text-red-500 font-medium">
										{errors.password}
									</p>
								)}
							</div>

							<div className="space-y-2">
								<Label htmlFor="confirmPassword">
									{t("signup.confirm_password_label")}
								</Label>
								<div className="relative">
									<Input
										id="confirmPassword"
										placeholder="••••••••"
										type={showConfirmPassword ? "text" : "password"}
										autoComplete="new-password"
										disabled={loading}
										value={formData.confirmPassword}
										onChange={(e) => {
											setFormData({
												...formData,
												confirmPassword: e.target.value,
											});
											if (errors.confirmPassword)
												setErrors({ ...errors, confirmPassword: "" });
										}}
										error={!!errors.confirmPassword}
										className="pr-10"
									/>
									<button
										type="button"
										onClick={() => setShowConfirmPassword(!showConfirmPassword)}
										className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
										tabIndex={-1}
									>
										{showConfirmPassword ? (
											<EyeOff className="h-4 w-4" />
										) : (
											<Eye className="h-4 w-4" />
										)}
									</button>
								</div>
								{errors.confirmPassword && (
									<p className="text-xs text-red-500 font-medium">
										{errors.confirmPassword}
									</p>
								)}
							</div>
						</div>

						<Button
							type="submit"
							variant="secondary"
							className="w-full"
							disabled={loading}
						>
							{loading ? (
								<span className="flex items-center gap-2">
									<span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
									{t("signup.creating_account")}
								</span>
							) : (
								<span className="flex items-center gap-2">
									{t("signup.submit")} <ArrowRight className="w-4 h-4" />
								</span>
							)}
						</Button>
					</form>

					<div className="relative">
						<div className="absolute inset-0 flex items-center">
							<span className="w-full border-t border-border" />
						</div>
						<div className="relative flex justify-center text-xs uppercase">
							<span className="bg-card px-2 text-muted-foreground">
								{t("signup.already_have_account")}
							</span>
						</div>
					</div>

					<div className="text-center">
						<button
							type="button"
							onClick={() => navigate({ to: "/login" })}
							className="text-sm font-medium hover:text-secondary transition-colors underline-offset-4 hover:underline"
						>
							{t("signup.log_in")}
						</button>
					</div>
				</div>
			</div>
		</>
	);
}
