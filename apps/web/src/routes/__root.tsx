import { Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { Toaster } from "sonner";

export const Route = createRootRoute({
	component: () => (
		<>
			<Outlet />
			<Toaster position="top-center" />
			<TanStackRouterDevtools />
		</>
	),
});
