/**
 * Unwrap API response: returns data or throws with error message.
 * API returns { data: T } on success or { error: { code, message } } on failure.
 * Throws ApiError with status when response is not ok.
 */
export class ApiError extends Error {
	constructor(
		message: string,
		public readonly status?: number,
		public readonly code?: string,
	) {
		super(message);
		this.name = "ApiError";
	}
}

export async function unwrapApiResponse<T>(res: Response): Promise<T> {
	const json = (await res.json()) as
		| { data: T }
		| { error: { code: string; message: string } };
	if (!res.ok) {
		const error =
			"error" in json
				? json.error
				: { code: "UNKNOWN", message: res.statusText };
		throw new ApiError(error.message, res.status, error.code);
	}
	if ("error" in json) {
		throw new ApiError(json.error.message, undefined, json.error.code);
	}
	return json.data;
}
