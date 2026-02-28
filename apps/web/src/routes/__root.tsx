import { Outlet, createRootRoute } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { FullPagePending } from "@/components/route-pending";
import { queryClient } from "@/lib/query-client";

export const Route = createRootRoute({
	pendingComponent: FullPagePending,
	component: () => (
		<QueryClientProvider client={queryClient}>
			<Outlet />
			<Toaster position="top-center" />
		</QueryClientProvider>
	),
});
