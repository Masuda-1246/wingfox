import { Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "sonner";
import { FullPagePending } from "@/components/route-pending";
import { queryClient } from "@/lib/query-client";

export const Route = createRootRoute({
	pendingComponent: FullPagePending,
	component: () => (
		<QueryClientProvider client={queryClient}>
			<Outlet />
			<Toaster position="top-center" />
			<TanStackRouterDevtools />
			<ReactQueryDevtools initialIsOpen={false} />
		</QueryClientProvider>
	),
});
