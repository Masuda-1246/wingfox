import { useCallback, useState } from "react";
import { MOCK_MATCHES } from "../mock-data";
import type { Matches } from "../types";

// TODO: Hono RPC に置き換え
export function useMatches() {
	const [matches, setMatches] = useState<Matches[]>(MOCK_MATCHES);
	const [isLoading, _setIsLoading] = useState(false);
	const [error, _setError] = useState<Error | null>(null);

	const add = useCallback(async (data: Matches) => {
		setMatches((prev) => [...prev, data]);
	}, []);

	const edit = useCallback(
		async (id: string, updates: Partial<Omit<Matches, "id">>) => {
			setMatches((prev) =>
				prev.map((m) => (m.id === id ? { ...m, ...updates } : m)),
			);
		},
		[],
	);

	const remove = useCallback(async (id: string) => {
		setMatches((prev) => prev.filter((m) => m.id !== id));
	}, []);

	const clearAll = useCallback(async () => {
		setMatches([]);
	}, []);

	return {
		matches,
		isLoading,
		error,
		add,
		edit,
		remove,
		clearAll,
	};
}
