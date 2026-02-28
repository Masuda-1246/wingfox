import type { Context } from "hono";

export type ErrorCode =
	| "BAD_REQUEST"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "NOT_FOUND"
	| "CONFLICT"
	| "RATE_LIMITED"
	| "INTERNAL_ERROR";

const statusByCode: Record<ErrorCode, number> = {
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	CONFLICT: 409,
	RATE_LIMITED: 429,
	INTERNAL_ERROR: 500,
};

export function jsonData<T>(c: Context, data: T, status = 200) {
	return c.json({ data }, status);
}

export function jsonError(c: Context, code: ErrorCode, message: string, status?: number) {
	const httpStatus = status ?? statusByCode[code];
	return c.json(
		{
			error: {
				code,
				message,
			},
		},
		httpStatus,
	);
}
