import { useCallback, useState } from "react";
import { MOCK_USERS } from "../mock-data";
import type { Users } from "../types";

// TODO: Hono RPC に置き換え
export function useUsers() {
	const [users, setUsers] = useState<Users[]>(MOCK_USERS);
	const [isLoading, _setIsLoading] = useState(false);
	const [error, _setError] = useState<Error | null>(null);

	const add = useCallback(async (data: Users) => {
		setUsers((prev) => [...prev, data]);
	}, []);

	const edit = useCallback(
		async (id: string, updates: Partial<Omit<Users, "id">>) => {
			setUsers((prev) =>
				prev.map((u) => (u.id === id ? { ...u, ...updates } : u)),
			);
		},
		[],
	);

	const remove = useCallback(async (id: string) => {
		setUsers((prev) => prev.filter((u) => u.id !== id));
	}, []);

	const clearAll = useCallback(async () => {
		setUsers([]);
	}, []);

	return {
		users,
		isLoading,
		error,
		add,
		edit,
		remove,
		clearAll,
	};
}
