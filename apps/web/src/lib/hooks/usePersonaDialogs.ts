import { useCallback, useState } from "react";
import { MOCK_PERSONA_DIALOGS } from "../mock-data";
import type { PersonaDialogs } from "../types";

// TODO: Hono RPC に置き換え
export function usePersonaDialogs() {
	const [personaDialogs, setPersonaDialogs] =
		useState<PersonaDialogs[]>(MOCK_PERSONA_DIALOGS);
	const [isLoading, _setIsLoading] = useState(false);
	const [error, _setError] = useState<Error | null>(null);

	const add = useCallback(async (data: PersonaDialogs) => {
		setPersonaDialogs((prev) => [...prev, data]);
	}, []);

	const edit = useCallback(
		async (id: string, updates: Partial<Omit<PersonaDialogs, "id">>) => {
			setPersonaDialogs((prev) =>
				prev.map((d) => (d.id === id ? { ...d, ...updates } : d)),
			);
		},
		[],
	);

	const remove = useCallback(async (id: string) => {
		setPersonaDialogs((prev) => prev.filter((d) => d.id !== id));
	}, []);

	const clearAll = useCallback(async () => {
		setPersonaDialogs([]);
	}, []);

	return {
		personaDialogs,
		isLoading,
		error,
		add,
		edit,
		remove,
		clearAll,
	};
}
