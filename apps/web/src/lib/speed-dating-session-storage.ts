/** sessionStorage key for speed-dating session restore on reload */
const KEY = "speed-dating-session";

export type PersistedPersona = { id: string; name: string };

export type SpeedDatingSessionState = {
	personas: PersistedPersona[];
	sessionId: string;
	personaIndex: number;
};

export function saveSpeedDatingSession(state: SpeedDatingSessionState): void {
	try {
		sessionStorage.setItem(KEY, JSON.stringify(state));
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
