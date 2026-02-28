import { WingfoxLogo } from "@/components/icons/WingfoxLogo";
import { FullPagePending } from "@/components/route-pending";
import { queryClient } from "@/lib/query-client";
import { QueryClientProvider } from "@tanstack/react-query";
import { Link, Outlet, createRootRoute } from "@tanstack/react-router";
import { LazyMotion, domAnimation } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Toaster } from "sonner";

function NotFound() {
	return (
		<div className="min-h-screen w-full flex flex-col items-center justify-center p-4 gap-8">
			<WingfoxLogo className="w-20 h-20" />
			<div className="text-center space-y-2">
				<h1 className="text-6xl font-black tracking-tighter text-secondary">
					404
				</h1>
				<p className="text-lg text-muted-foreground">Page not found</p>
			</div>
			<Link
				to="/"
				className="inline-flex items-center gap-2 rounded-full bg-secondary px-6 py-2.5 text-sm font-medium text-secondary-foreground hover:opacity-90 transition-colors"
			>
				<ArrowLeft className="w-4 h-4" />
				Home
			</Link>
		</div>
	);
}

export const Route = createRootRoute({
	pendingComponent: FullPagePending,
	notFoundComponent: NotFound,
	component: () => (
		<QueryClientProvider client={queryClient}>
			<LazyMotion features={domAnimation} strict>
				<Outlet />
			</LazyMotion>
			<Toaster position="top-center" />
		</QueryClientProvider>
	),
});
