import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { toast } from "sonner";

export const queryClient = new QueryClient({
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
