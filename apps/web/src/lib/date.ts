import { format } from "date-fns";
import { enUS, ja } from "date-fns/locale";
import i18n from "i18next";

function getLocale() {
	return i18n.language === "en" ? enUS : ja;
}

export function formatDate(date: Date): string {
	return format(date, "yyyy/MM/dd", { locale: getLocale() });
}

export function formatDateTime(date: Date): string {
	return format(date, "yyyy/MM/dd HH:mm", { locale: getLocale() });
}

export function formatTime(date: Date): string {
	return format(date, "HH:mm", { locale: getLocale() });
}
