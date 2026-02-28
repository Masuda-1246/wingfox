import { UpperHeader } from "@/components/layouts/UpperHeader";
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated")({
	beforeLoad: () => {
		const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";
		if (!isAuthenticated) {
			throw redirect({ to: "/login" });
		}
	},
	component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
	return (
		<>
			<UpperHeader />
			<Outlet />
		</>
	);
}
