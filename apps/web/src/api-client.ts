import type { AppType } from "@repo/api";
import { hc } from "hono/client";
import { supabase } from "./lib/supabase";

function getBaseUrl(): string {
	if (typeof window !== "undefined") return window.location.origin;
	return "";
}

export const client = hc<AppType>(getBaseUrl(), {
	fetch: async (input, init) => {
		const { data } = await supabase.auth.getSession({ refresh: true });
		const headers = new Headers(init?.headers);
		headers.set("Content-Type", "application/json");
		if (data.session?.access_token) {
			headers.set("Authorization", `Bearer ${data.session.access_token}`);
		}
		return fetch(input, { ...init, headers });
	},
});
