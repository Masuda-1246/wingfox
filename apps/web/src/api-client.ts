import type { AppType } from "@repo/api";
import { hc } from "hono/client";
import i18n from "./i18n";
import { supabase } from "./lib/supabase";

function getBaseUrl(): string {
	if (typeof window !== "undefined") return window.location.origin;
	return "";
}

export type ApiClient = ReturnType<typeof hc<AppType>>;

const _client = hc<AppType>(getBaseUrl(), {
	fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
		const { data } = await supabase.auth.getSession();
		const headers = new Headers(init?.headers);
		headers.set("Content-Type", "application/json");
		headers.set("Accept-Language", i18n.language || "ja");
		if (data.session?.access_token) {
			headers.set("Authorization", `Bearer ${data.session.access_token}`);
		}
		const res = await fetch(input, { ...init, headers });
		if (
			res.status === 401 &&
			typeof window !== "undefined" &&
			window.location.pathname !== "/login"
		) {
			window.location.href = "/login";
		}
		return res;
	},
});

// Workaround: AppType from @repo/api can resolve to unknown in consumers; use any so client is usable until TS resolution is fixed
export const client = _client as any;
