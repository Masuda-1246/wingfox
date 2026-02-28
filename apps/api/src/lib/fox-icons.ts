/** Icon paths under /foxes (apps/web/public/foxes). Key = gender. */
export const FOX_ICONS: Record<string, string[]> = {
	male: [
		"/foxes/male/normal.png",
		"/foxes/male/balckfox.png",
		"/foxes/male/glasses.png",
		"/foxes/male/face.png",
		"/foxes/male/sunglasses.png",
		"/foxes/male/tie.png",
		"/foxes/male/pias.png",
		"/foxes/male/redfox.png",
		"/foxes/male/redfox_face.png",
		"/foxes/male/redfox_glasses.png",
		"/foxes/male/blackfox_glasses.png",
	],
	female: [
		"/foxes/female/ribbon.png",
		"/foxes/female/whitefox_glasses.png",
		"/foxes/female/whitefox.png",
		"/foxes/female/whtefox_hat.png",
		"/foxes/female/pinkfox.png",
		"/foxes/female/pinkfox_cap.png",
		"/foxes/female/whitefox_blue_ribbon.png",
		"/foxes/female/blue_fox.png",
		"/foxes/female/pinkfox_ribbon.png",
	],
};

const FOX_ICONS_ALL = [...FOX_ICONS.male, ...FOX_ICONS.female];

/** Returns a random icon path for the given gender (e.g. from user_profiles.gender or persona gender). */
export function getRandomIconUrlForGender(gender: string): string {
	const g = (gender ?? "").toLowerCase();
	const pool =
		g === "male" ? FOX_ICONS.male : g === "female" ? FOX_ICONS.female : FOX_ICONS_ALL;
	return pool[Math.floor(Math.random() * pool.length)];
}
