import { Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster, toast } from "sonner";
import { ApiError } from "@/lib/api";

const queryClient = new QueryClient({
		defaultOptions: {
		queries: {
			staleTime: 60 * 1000,
			retry: (failureCount, error) => {
				if (error instanceof ApiError && error.status === 401) return false;
				return failureCount < 2;
			},
		},
		mutations: {
			onError: (error: unknown) => {
				if (error instanceof ApiError) {
					if (error.status === 401) {
						window.location.href = "/login";
						return;
					}
					toast.error(error.message);
				} else if (error instanceof Error) {
					toast.error(error.message);
				}
			},
		},
	},
});

export const Route = createRootRoute({
	component: () => (
		<QueryClientProvider client={queryClient}>
			<Outlet />
			<Toaster position="top-center" />
			<TanStackRouterDevtools />
			<ReactQueryDevtools initialIsOpen={false} />
		</QueryClientProvider>
	),
});
