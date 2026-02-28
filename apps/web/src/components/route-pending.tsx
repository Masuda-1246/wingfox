import { Loader2 } from "lucide-react";

interface RoutePendingProps {
	fullPage?: boolean;
}

function RoutePending({ fullPage = false }: RoutePendingProps) {
	return (
		<div
			className={
				fullPage
					? "flex min-h-screen items-center justify-center"
					: "flex min-h-[60vh] items-center justify-center"
			}
		>
			<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
		</div>
	);
}

export function FullPagePending() {
	return <RoutePending fullPage />;
}

export function ContentPending() {
	return <RoutePending />;
}
