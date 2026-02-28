import { createFileRoute } from "@tanstack/react-router";
import { client } from "../../api-client";
import logo from "../../assets/logo.svg";

export const Route = createFileRoute("/")({
	component: App,
	loader: async () => {
		const response = await client.api.hello.$get();
		return response.json();
	},
});

function App() {
	const data = Route.useLoaderData();
	return (
		<div className="text-center">
			<header className="min-h-screen flex flex-col items-center justify-center bg-[#282c34] text-white text-[calc(10px+2vmin)]">
				<img
					src={logo}
					className="h-[40vmin] pointer-events-none animate-[spin_20s_linear_infinite]"
					alt="logo"
				/>
				<p>
					Edit <code>src/routes/index.tsx</code> and save to reload.
				</p>
				<a
					className="text-[#61dafb] hover:underline"
					href="https://reactjs.org"
					target="_blank"
					rel="noopener noreferrer"
				>
					Learn React
				</a>
				<a
					className="text-[#61dafb] hover:underline"
					href="https://tanstack.com"
					target="_blank"
					rel="noopener noreferrer"
				>
					Learn TanStack
				</a>
				<p>{data.message}</p>
			</header>
		</div>
	);
}
