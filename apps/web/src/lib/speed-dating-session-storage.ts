/** sessionStorage key for speed-dating session restore on reload */
const KEY = "speed-dating-session";
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

export type PersistedPersona = { id: string; name: string };

export type SpeedDatingSessionState = {
	personas: PersistedPersona[];
	sessionId: string;
	personaIndex: number;
	savedAt: number;
};

export function saveSpeedDatingSession(
	state: Omit<SpeedDatingSessionState, "savedAt">,
): void {
	try {
		const withTimestamp: SpeedDatingSessionState = {
			...state,
			savedAt: Date.now(),
		};
		sessionStorage.setItem(KEY, JSON.stringify(withTimestamp));
	} catch {
		// ignore
	}
}

export function loadSpeedDatingSession(): SpeedDatingSessionState | null {
	try {
		const raw = sessionStorage.getItem(KEY);
		if (!raw) return null;
		const data = JSON.parse(raw) as SpeedDatingSessionState;
		if (
			!data.personas?.length ||
			!data.sessionId ||
			typeof data.personaIndex !== "number"
		)
			return null;
		if (
			data.personas.length < 3 ||
			data.personaIndex < 0 ||
			data.personaIndex > 2
		)
			return null;
		if (data.savedAt && Date.now() - data.savedAt > SESSION_TTL_MS) {
			clearSpeedDatingSession();
			return null;
		}
		return data;
	} catch {
		return null;
	}
}

export function clearSpeedDatingSession(): void {
	try {
		sessionStorage.removeItem(KEY);
	} catch {
		// ignore
	}
}
