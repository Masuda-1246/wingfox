import type { AppType } from "@repo/api";
import { hc } from "hono/client";

export const client = hc<AppType>(window.location.origin, {
	headers: {
		"Content-Type": "application/json",
	},
});
