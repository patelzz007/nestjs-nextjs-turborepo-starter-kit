// ============================================
// labels.ts - the preferences' words in every shipped language (ADR 076)
// ============================================
// The preference values' names (one place, so Settings, the drawer and the sub-screens agree), the
// Appearance and Language screens' copy, and the toasts that confirm a change. Malay, Chinese and Tamil
// reuse the web UI kit's words where it says the same thing (System, Light, Dark, Nord).

import type { RadioOption } from "@workspace/ui-native/components/radio-group";
import type { LabelPack } from "../language/label-pack";
import {
	APP_LOCK_TIMEOUT_FIVE_MINUTES_MS,
	APP_LOCK_TIMEOUT_IMMEDIATELY_MS,
	APP_LOCK_TIMEOUT_ONE_MINUTE_MS,
	DrawerStyleSchema,
	type AppLockTimeoutMs,
	type DrawerStyle,
	type ThemePreference,
} from "../../lib/secure-store";

export interface PreferencesLabels {
	readonly themes: Readonly<Record<ThemePreference, string>>;
	/** The side drawer's looks, as the radio options name them. */
	readonly drawerStyles: Readonly<Record<DrawerStyle, string>>;
	/** The line under the themes that need one. */
	readonly themeDescriptions: { readonly system: string; readonly nord: string };
	readonly appearance: { readonly description: string; readonly theme: string; readonly drawerStyle: string };
	readonly language: { readonly description: string; readonly label: string };
	/** The app lock's timeouts, as the radio options name them. */
	readonly appLockTimeouts: Readonly<Record<AppLockTimeoutMs, string>>;
	/** Confirmations of preference changes, shown as a toast. */
	readonly messages: {
		readonly themeChanged: (themeName: string) => string;
		readonly drawerStyleChanged: (styleName: string) => string;
		readonly languageChanged: (languageName: string) => string;
		readonly appLockTurnedOn: string;
		readonly appLockTurnedOff: string;
		readonly appLockTimeoutChanged: Readonly<Record<AppLockTimeoutMs, string>>;
	};
}

const EN: PreferencesLabels = {
	themes: { system: "System", light: "Light", dark: "Dark", nord: "Nord", "current-dark": "Current Dark", harbour: "Harbour", mocha: "Mocha" },
	drawerStyles: {
		"centred-ink": "Centred dark",
		"ink-cards": "Dark with cards",
		"wash-sheet": "Soft with sheet",
		"centred-wash": "Centred soft",
		"wash-cards": "Soft with cards",
	},
	themeDescriptions: { system: "Follow the device's light or dark setting", nord: "A dark theme in Nord's arctic blues" },
	appearance: { description: "Choose how the app looks on this device.", theme: "Theme", drawerStyle: "Side menu" },
	language: { description: "Choose the language the app uses on this device.", label: "Language" },
	appLockTimeouts: {
		[APP_LOCK_TIMEOUT_IMMEDIATELY_MS]: "Immediately",
		[APP_LOCK_TIMEOUT_ONE_MINUTE_MS]: "After 1 minute",
		[APP_LOCK_TIMEOUT_FIVE_MINUTES_MS]: "After 5 minutes",
	},
	messages: {
		themeChanged: (themeName: string): string => `Theme set to ${themeName}.`,
		drawerStyleChanged: (styleName: string): string => `Side menu set to ${styleName}.`,
		languageChanged: (languageName: string): string => `Language set to ${languageName}.`,
		appLockTurnedOn: "App lock turned on.",
		appLockTurnedOff: "App lock turned off.",
		appLockTimeoutChanged: {
			[APP_LOCK_TIMEOUT_IMMEDIATELY_MS]: "The app will lock immediately.",
			[APP_LOCK_TIMEOUT_ONE_MINUTE_MS]: "The app will lock after 1 minute.",
			[APP_LOCK_TIMEOUT_FIVE_MINUTES_MS]: "The app will lock after 5 minutes.",
		},
	},
};

const MS: PreferencesLabels = {
	themes: { system: "Sistem", light: "Cerah", dark: "Gelap", nord: "Nord", "current-dark": "Gelap Semasa", harbour: "Harbour", mocha: "Mocha" },
	drawerStyles: {
		"centred-ink": "Gelap tengah",
		"ink-cards": "Gelap dengan kad",
		"wash-sheet": "Lembut dengan helaian",
		"centred-wash": "Lembut tengah",
		"wash-cards": "Lembut dengan kad",
	},
	themeDescriptions: { system: "Ikut tetapan cerah atau gelap peranti", nord: "Tema gelap dalam warna biru artik Nord" },
	appearance: { description: "Pilih rupa aplikasi pada peranti ini.", theme: "Tema", drawerStyle: "Menu sisi" },
	language: { description: "Pilih bahasa yang digunakan aplikasi pada peranti ini.", label: "Bahasa" },
	appLockTimeouts: {
		[APP_LOCK_TIMEOUT_IMMEDIATELY_MS]: "Serta-merta",
		[APP_LOCK_TIMEOUT_ONE_MINUTE_MS]: "Selepas 1 minit",
		[APP_LOCK_TIMEOUT_FIVE_MINUTES_MS]: "Selepas 5 minit",
	},
	messages: {
		themeChanged: (themeName: string): string => `Tema ditetapkan kepada ${themeName}.`,
		drawerStyleChanged: (styleName: string): string => `Menu sisi ditetapkan kepada ${styleName}.`,
		languageChanged: (languageName: string): string => `Bahasa ditetapkan kepada ${languageName}.`,
		appLockTurnedOn: "Kunci aplikasi dihidupkan.",
		appLockTurnedOff: "Kunci aplikasi dimatikan.",
		appLockTimeoutChanged: {
			[APP_LOCK_TIMEOUT_IMMEDIATELY_MS]: "Aplikasi akan dikunci serta-merta.",
			[APP_LOCK_TIMEOUT_ONE_MINUTE_MS]: "Aplikasi akan dikunci selepas 1 minit.",
			[APP_LOCK_TIMEOUT_FIVE_MINUTES_MS]: "Aplikasi akan dikunci selepas 5 minit.",
		},
	},
};

const ZH_HANS: PreferencesLabels = {
	themes: { system: "跟随系统", light: "浅", dark: "深", nord: "Nord", "current-dark": "当前深色", harbour: "Harbour", mocha: "Mocha" },
	drawerStyles: { "centred-ink": "居中深色", "ink-cards": "深色卡片", "wash-sheet": "柔和面板", "centred-wash": "居中柔和", "wash-cards": "柔和卡片" },
	themeDescriptions: { system: "跟随设备的浅色或深色设置", nord: "采用 Nord 北极蓝色调的深色主题" },
	appearance: { description: "选择应用在此设备上的外观。", theme: "主题", drawerStyle: "侧边菜单" },
	language: { description: "选择应用在此设备上使用的语言。", label: "语言" },
	appLockTimeouts: {
		[APP_LOCK_TIMEOUT_IMMEDIATELY_MS]: "立即",
		[APP_LOCK_TIMEOUT_ONE_MINUTE_MS]: "1 分钟后",
		[APP_LOCK_TIMEOUT_FIVE_MINUTES_MS]: "5 分钟后",
	},
	messages: {
		themeChanged: (themeName: string): string => `主题已设为${themeName}。`,
		drawerStyleChanged: (styleName: string): string => `侧边菜单已设为${styleName}。`,
		languageChanged: (languageName: string): string => `语言已设为${languageName}。`,
		appLockTurnedOn: "应用锁已开启。",
		appLockTurnedOff: "应用锁已关闭。",
		appLockTimeoutChanged: {
			[APP_LOCK_TIMEOUT_IMMEDIATELY_MS]: "应用将立即锁定。",
			[APP_LOCK_TIMEOUT_ONE_MINUTE_MS]: "应用将在 1 分钟后锁定。",
			[APP_LOCK_TIMEOUT_FIVE_MINUTES_MS]: "应用将在 5 分钟后锁定。",
		},
	},
};

const TA: PreferencesLabels = {
	themes: { system: "சாதனம்", light: "வெளிர்", dark: "அடர்", nord: "Nord", "current-dark": "தற்போதைய அடர்", harbour: "Harbour", mocha: "Mocha" },
	drawerStyles: { "centred-ink": "நடுவில் அடர்", "ink-cards": "அடர் அட்டைகள்", "wash-sheet": "மென்மையான தாள்", "centred-wash": "நடுவில் மென்மை", "wash-cards": "மென்மையான அட்டைகள்" },
	themeDescriptions: { system: "சாதனத்தின் வெளிர் அல்லது அடர் அமைப்பைப் பின்பற்று", nord: "Nord-இன் ஆர்க்டிக் நீல நிறங்களில் ஓர் அடர் தீம்" },
	appearance: { description: "இந்தச் சாதனத்தில் செயலி எப்படித் தோன்ற வேண்டும் எனத் தேர்ந்தெடுங்கள்.", theme: "தீம்", drawerStyle: "பக்க மெனு" },
	language: { description: "இந்தச் சாதனத்தில் செயலி பயன்படுத்தும் மொழியைத் தேர்ந்தெடுங்கள்.", label: "மொழி" },
	appLockTimeouts: {
		[APP_LOCK_TIMEOUT_IMMEDIATELY_MS]: "உடனடியாக",
		[APP_LOCK_TIMEOUT_ONE_MINUTE_MS]: "1 நிமிடத்திற்குப் பிறகு",
		[APP_LOCK_TIMEOUT_FIVE_MINUTES_MS]: "5 நிமிடங்களுக்குப் பிறகு",
	},
	messages: {
		themeChanged: (themeName: string): string => `தீம் ${themeName} என அமைக்கப்பட்டது.`,
		drawerStyleChanged: (styleName: string): string => `பக்க மெனு ${styleName} என அமைக்கப்பட்டது.`,
		languageChanged: (languageName: string): string => `மொழி ${languageName} என அமைக்கப்பட்டது.`,
		appLockTurnedOn: "செயலிப் பூட்டு இயக்கப்பட்டது.",
		appLockTurnedOff: "செயலிப் பூட்டு முடக்கப்பட்டது.",
		appLockTimeoutChanged: {
			[APP_LOCK_TIMEOUT_IMMEDIATELY_MS]: "செயலி உடனடியாகப் பூட்டப்படும்.",
			[APP_LOCK_TIMEOUT_ONE_MINUTE_MS]: "செயலி 1 நிமிடத்திற்குப் பிறகு பூட்டப்படும்.",
			[APP_LOCK_TIMEOUT_FIVE_MINUTES_MS]: "செயலி 5 நிமிடங்களுக்குப் பிறகு பூட்டப்படும்.",
		},
	},
};

export const PREFERENCES_LABELS: LabelPack<PreferencesLabels> = { en: EN, ms: MS, "zh-Hans": ZH_HANS, ta: TA };

/** The Appearance screen's choices, in `labels`' language. */
export function themeOptionsOf(labels: PreferencesLabels): readonly RadioOption<ThemePreference>[] {
	return [
		{ value: "system", label: labels.themes.system, description: labels.themeDescriptions.system },
		{ value: "light", label: labels.themes.light },
		{ value: "dark", label: labels.themes.dark },
		{ value: "nord", label: labels.themes.nord, description: labels.themeDescriptions.nord },
		{ value: "current-dark", label: labels.themes["current-dark"] },
		{ value: "harbour", label: labels.themes.harbour },
		{ value: "mocha", label: labels.themes.mocha },
	];
}

/** The side drawer's looks as radio options, the default first. */
export function drawerStyleOptionsOf(labels: PreferencesLabels): readonly RadioOption<DrawerStyle>[] {
	return DrawerStyleSchema.options.map((value: DrawerStyle): RadioOption<DrawerStyle> => ({ value, label: labels.drawerStyles[value] }));
}

/** The app lock's timeout choices, in `labels`' language. */
export function appLockTimeoutOptionsOf(labels: PreferencesLabels): readonly RadioOption<AppLockTimeoutMs>[] {
	return [
		{ value: APP_LOCK_TIMEOUT_IMMEDIATELY_MS, label: labels.appLockTimeouts[APP_LOCK_TIMEOUT_IMMEDIATELY_MS] },
		{ value: APP_LOCK_TIMEOUT_ONE_MINUTE_MS, label: labels.appLockTimeouts[APP_LOCK_TIMEOUT_ONE_MINUTE_MS] },
		{ value: APP_LOCK_TIMEOUT_FIVE_MINUTES_MS, label: labels.appLockTimeouts[APP_LOCK_TIMEOUT_FIVE_MINUTES_MS] },
	];
}
