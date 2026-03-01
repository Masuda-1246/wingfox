import { supabase } from "@/lib/supabase";
import type { Session, User } from "@supabase/supabase-js";
import {
	type ReactNode,
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";

type AuthState = {
	user: User | null;
	session: Session | null;
	loading: boolean;
};

type AuthContextValue = AuthState & {
	signIn: (
		email: string,
		password: string,
	) => Promise<{ error: { message: string } | null }>;
	signUp: (
		email: string,
		password: string,
		options?: { displayName?: string },
	) => Promise<{ error: { message: string } | null }>;
	signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [state, setState] = useState<AuthState>({
		user: null,
		session: null,
		loading: true,
	});

	useEffect(() => {
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, session) => {
			setState({
				user: session?.user ?? null,
				session,
				loading: false,
			});
		});

		supabase.auth.getSession().then(({ data: { session } }) => {
			setState({
				user: session?.user ?? null,
				session: session ?? null,
				loading: false,
			});
		});

		return () => subscription.unsubscribe();
	}, []);

	const signIn = useCallback(async (email: string, password: string) => {
		const { error } = await supabase.auth.signInWithPassword({
			email,
			password,
		});
		return { error: error ? { message: error.message } : null };
	}, []);

	const signUp = useCallback(
		async (
			email: string,
			password: string,
			_options?: { displayName?: string },
		) => {
			const { error } = await supabase.auth.signUp({ email, password });
			return { error: error ? { message: error.message } : null };
		},
		[],
	);

	const signOut = useCallback(async () => {
		await supabase.auth.signOut();
	}, []);

	const value: AuthContextValue = {
		...state,
		signIn,
		signUp,
		signOut,
	};

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
	const ctx = useContext(AuthContext);
	if (!ctx) {
		throw new Error("useAuth must be used within AuthProvider");
	}
	return ctx;
}
