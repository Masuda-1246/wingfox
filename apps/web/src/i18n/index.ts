import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import enAuth from "./locales/en/auth.json";
import enChat from "./locales/en/chat.json";
import enCommon from "./locales/en/common.json";
import enPersonas from "./locales/en/personas.json";
import enReports from "./locales/en/reports.json";
import enSettings from "./locales/en/settings.json";
import jaAuth from "./locales/ja/auth.json";
import jaChat from "./locales/ja/chat.json";
import jaCommon from "./locales/ja/common.json";
import jaPersonas from "./locales/ja/personas.json";
import jaReports from "./locales/ja/reports.json";
import jaSettings from "./locales/ja/settings.json";

i18n
	.use(LanguageDetector)
	.use(initReactI18next)
	.init({
		resources: {
			ja: {
				common: jaCommon,
				auth: jaAuth,
				chat: jaChat,
				personas: jaPersonas,
				reports: jaReports,
				settings: jaSettings,
			},
			en: {
				common: enCommon,
				auth: enAuth,
				chat: enChat,
				personas: enPersonas,
				reports: enReports,
				settings: enSettings,
			},
		},
		fallbackLng: "ja",
		defaultNS: "common",
		interpolation: {
			escapeValue: false,
		},
		detection: {
			order: ["localStorage", "navigator"],
			lookupLocalStorage: "i18nextLng",
			caches: ["localStorage"],
		},
	});

export default i18n;
