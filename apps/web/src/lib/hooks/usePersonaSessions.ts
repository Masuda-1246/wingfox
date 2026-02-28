import { useCallback, useState } from "react";
import { MOCK_PERSONA_SESSIONS } from "../mock-data";
import type { PersonaSessions } from "../types";

// TODO: Hono RPC に置き換え
export function usePersonaSessions() {
	const [personaSessions, setPersonaSessions] = useState<PersonaSessions[]>(
		MOCK_PERSONA_SESSIONS,
	);
	const [isLoading, _setIsLoading] = useState(false);
	const [error, _setError] = useState<Error | null>(null);

	const add = useCallback(async (data: PersonaSessions) => {
		setPersonaSessions((prev) => [...prev, data]);
	}, []);

	const edit = useCallback(
		async (id: string, updates: Partial<Omit<PersonaSessions, "id">>) => {
			setPersonaSessions((prev) =>
				prev.map((s) => (s.id === id ? { ...s, ...updates } : s)),
			);
		},
		[],
	);

	const remove = useCallback(async (id: string) => {
		setPersonaSessions((prev) => prev.filter((s) => s.id !== id));
	}, []);

	const clearAll = useCallback(async () => {
		setPersonaSessions([]);
	}, []);

	return {
		personaSessions,
		isLoading,
		error,
		add,
		edit,
		remove,
		clearAll,
	};
}
