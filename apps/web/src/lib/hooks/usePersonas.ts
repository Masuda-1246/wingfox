import { useCallback, useState } from "react";
import { MOCK_PERSONAS } from "../mock-data";
import type { Personas } from "../types";

// TODO: Hono RPC に置き換え
export function usePersonas() {
	const [personas, setPersonas] = useState<Personas[]>(MOCK_PERSONAS);
	const [isLoading, _setIsLoading] = useState(false);
	const [error, _setError] = useState<Error | null>(null);

	const add = useCallback(async (data: Personas) => {
		setPersonas((prev) => [...prev, data]);
	}, []);

	const edit = useCallback(
		async (id: string, updates: Partial<Omit<Personas, "id">>) => {
			setPersonas((prev) =>
				prev.map((p) => (p.id === id ? { ...p, ...updates } : p)),
			);
		},
		[],
	);

	const remove = useCallback(async (id: string) => {
		setPersonas((prev) => prev.filter((p) => p.id !== id));
	}, []);

	const clearAll = useCallback(async () => {
		setPersonas([]);
	}, []);

	return {
		personas,
		isLoading,
		error,
		add,
		edit,
		remove,
		clearAll,
	};
}
