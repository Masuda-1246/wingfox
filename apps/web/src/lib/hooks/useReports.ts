import { useCallback, useState } from "react";
import { MOCK_REPORTS } from "../mock-data";
import type { Reports } from "../types";

// TODO: Hono RPC に置き換え
export function useReports() {
	const [reports, setReports] = useState<Reports[]>(MOCK_REPORTS);
	const [isLoading, _setIsLoading] = useState(false);
	const [error, _setError] = useState<Error | null>(null);

	const add = useCallback(async (data: Reports) => {
		setReports((prev) => [data, ...prev]);
	}, []);

	const edit = useCallback(
		async (id: string, updates: Partial<Omit<Reports, "id">>) => {
			setReports((prev) =>
				prev.map((r) => (r.id === id ? { ...r, ...updates } : r)),
			);
		},
		[],
	);

	const remove = useCallback(async (id: string) => {
		setReports((prev) => prev.filter((r) => r.id !== id));
	}, []);

	const clearAll = useCallback(async () => {
		setReports([]);
	}, []);

	return {
		reports,
		isLoading,
		error,
		add,
		edit,
		remove,
		clearAll,
	};
}
