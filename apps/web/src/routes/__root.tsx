import { FullPagePending } from "@/components/route-pending";
import { queryClient } from "@/lib/query-client";
import { QueryClientProvider } from "@tanstack/react-query";
import { Outlet, createRootRoute } from "@tanstack/react-router";
import { LazyMotion, domAnimation } from "framer-motion";
import { Toaster } from "sonner";

export const Route = createRootRoute({
	pendingComponent: FullPagePending,
	component: () => (
		<QueryClientProvider client={queryClient}>
			<LazyMotion features={domAnimation} strict>
				<Outlet />
			</LazyMotion>
			<Toaster position="top-center" />
		</QueryClientProvider>
	),
});
