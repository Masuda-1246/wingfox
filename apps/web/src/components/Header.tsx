import { Link } from "@tanstack/react-router";
import { ThemeToggle } from "./theme-toggle";

export default function Header() {
	return (
		<header className="p-4 flex gap-2 bg-background border-b border-border justify-between items-center">
			<nav className="flex flex-row">
				<div className="px-2 font-bold">
					<Link
						to="/"
						className="text-foreground hover:text-primary transition-colors"
					>
						Home
					</Link>
				</div>
			</nav>
			<div className="flex items-center gap-2">
				<ThemeToggle />
			</div>
		</header>
	);
}
