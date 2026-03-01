export const TOKYO_TIMEZONE = "Asia/Tokyo";

export function toDateStringInTimeZone(
	date: Date,
	timeZone: string,
): string {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(date);

	const year = parts.find((part) => part.type === "year")?.value;
	const month = parts.find((part) => part.type === "month")?.value;
	const day = parts.find((part) => part.type === "day")?.value;

	if (!year || !month || !day) {
		throw new Error(`Failed to format date in timezone: ${timeZone}`);
	}

	return `${year}-${month}-${day}`;
}

export function getTodayInTimeZone(timeZone: string): string {
	return toDateStringInTimeZone(new Date(), timeZone);
}
