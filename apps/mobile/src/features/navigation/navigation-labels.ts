// ============================================
// navigation-labels.ts - the app's navigation and Settings page in every shipped language (ADR 076)
// ============================================
// What the tab bar, the drawer, the page header and the Settings screen say: one typed pack, one value
// per language, so a missing word in one language is a type error (and fails the label-pack test).
// English names screens with the constants their own contexts own (TILL_TITLE, …), so a screen and its
// heading never drift. Malay, Chinese and Tamil reuse the web packs' words where the web already says
// the same thing; new words are marked for a native reader's check in the change that added them.
//
// Headings whose title depends on the screen's params (two-factor, a commit, a pull request) are
// resolved by their own contexts and stay English until those contexts are translated.

import { z } from "zod";

import { DEVICES_COPY } from "../../contexts/identity";
import { COMMITS_TITLE, FILES_CHANGED_TITLE, GITHUB_ACCOUNT_TITLE, PULL_REQUESTS_TITLE } from "../../contexts/integrations-github";
import { NOTIFICATION_SETTINGS_TITLE, NOTIFICATIONS_TITLE } from "../../contexts/notifications";
import { SERVER_TITLE, SERVERS_TITLE } from "../../contexts/operations";
import { TILL_TITLE } from "../../contexts/pos";
import type { LabelPack } from "../language/label-pack";
import { PDF_VIEWER_TITLE } from "../pdf-viewer/labels";
import type { AppTabName } from "./app-tabs";

/** What the header shows for a screen: its title, and one line under it saying what the page is for. */
export interface ScreenHeading {
	readonly title: string;
	readonly subtitle: string;
}

/** The signed-in screens with a fixed heading other than the tabs. */
export type SubScreen =
	| "security"
	| "devices"
	| "appearance"
	| "appLock"
	| "language"
	| "components"
	| "till"
	| "notifications"
	| "notificationSettings"
	| "pdfViewer"
	| "pullRequests"
	| "pullRequestFiles"
	| "pullRequestCommits"
	| "githubAccount"
	| "servers"
	| "server";

/** A heading the navigation translates: a tab's (by its route name) or a sub-screen's. */
export type HeadingKey = AppTabName | SubScreen;

/** The drawer's titled sections: a section's `labelKey` in mobile-drawer-items.json. */
export const DrawerSectionSchema = z.enum(["account", "preferences", "rewards", "documents", "developer", "github", "operations"]);

export type DrawerSection = z.output<typeof DrawerSectionSchema>;

/** The Settings tab's own words (src/app/(app)/settings/index.tsx); its rows reuse the screens' headings. */
export interface SettingsLabels {
	readonly securityDescription: string;
	readonly tillDescription: string;
	readonly pdfViewerDescription: string;
	readonly about: string;
	readonly version: string;
	readonly build: string;
	readonly apiAddress: string;
	readonly replayOnboarding: string;
	readonly replayOnboardingHint: string;
	readonly signOut: string;
	readonly on: string;
	readonly off: string;
}

export interface NavigationLabels {
	readonly headings: Readonly<Record<HeadingKey, ScreenHeading>>;
	readonly sections: Readonly<Record<DrawerSection, string>>;
	readonly drawer: {
		readonly editProfile: string;
		readonly signOut: string;
	};
	/** The command palette, opened from the page header's search button (ADR 079). */
	readonly commandPalette: {
		readonly title: string;
		readonly placeholder: string;
		readonly empty: string;
		/** The group of the tabs' screens. */
		readonly goTo: string;
	};
	readonly settings: SettingsLabels;
}

const EN: NavigationLabels = {
	headings: {
		index: { title: "Home", subtitle: "Your account at a glance" },
		analytics: { title: "Analytics", subtitle: "Your activity over time" },
		search: { title: "Search", subtitle: "Find anything in the app" },
		profile: { title: "Profile", subtitle: "Your personal details" },
		settings: { title: "Settings", subtitle: "Manage your preferences and account" },
		security: { title: "Security", subtitle: "Your password and sign-in" },
		devices: { title: DEVICES_COPY.title, subtitle: "Where your account is signed in" },
		appearance: { title: "Appearance", subtitle: "Choose how the app looks" },
		appLock: { title: "App lock", subtitle: "Lock the app when you leave it" },
		language: { title: "Language", subtitle: "Choose the app's language" },
		components: { title: "Components", subtitle: "The UI kit, live" },
		till: { title: TILL_TITLE, subtitle: "Scan and redeem customers' rewards" },
		notifications: { title: NOTIFICATIONS_TITLE, subtitle: "Everything we've told you" },
		notificationSettings: { title: NOTIFICATION_SETTINGS_TITLE, subtitle: "What reaches you, and where" },
		pdfViewer: { title: PDF_VIEWER_TITLE, subtitle: "Read a document" },
		pullRequests: { title: PULL_REQUESTS_TITLE, subtitle: "Your open and recent pull requests" },
		pullRequestFiles: { title: FILES_CHANGED_TITLE, subtitle: "Every changed file, with its diff" },
		pullRequestCommits: { title: COMMITS_TITLE, subtitle: "The pull request's commits" },
		githubAccount: { title: GITHUB_ACCOUNT_TITLE, subtitle: "The token the app reads GitHub with" },
		servers: { title: SERVERS_TITLE, subtitle: "Every machine the platform runs on" },
		server: { title: SERVER_TITLE, subtitle: "Its history and its spec" },
	},
	sections: {
		account: "Account",
		preferences: "Preferences",
		rewards: "Rewards",
		documents: "Documents",
		developer: "Developer",
		github: "GitHub",
		operations: "Operations",
	},
	drawer: {
		editProfile: "Edit profile",
		signOut: "Sign out",
	},
	commandPalette: {
		title: "Search",
		placeholder: "Search the app",
		empty: "Nothing matches that.",
		goTo: "Go to",
	},

	settings: {
		securityDescription: "Password, two-factor authentication, backup codes",
		tillDescription: "Scan and redeem customers' reward QR codes",
		pdfViewerDescription: "Read a PDF from your phone",
		about: "About",
		version: "Version",
		build: "Build",
		apiAddress: "API address",
		replayOnboarding: "Sign out and replay onboarding",
		replayOnboardingHint: "Development and test builds only: shows the first-launch walkthrough again",
		signOut: "Sign out",
		on: "On",
		off: "Off",
	},
};

const MS: NavigationLabels = {
	headings: {
		index: { title: "Utama", subtitle: "Akaun anda secara ringkas" },
		analytics: { title: "Analitik", subtitle: "Aktiviti anda dari semasa ke semasa" },
		search: { title: "Cari", subtitle: "Cari apa sahaja dalam aplikasi" },
		profile: { title: "Profil", subtitle: "Butiran peribadi anda" },
		settings: { title: "Tetapan", subtitle: "Urus keutamaan dan akaun anda" },
		security: { title: "Keselamatan", subtitle: "Kata laluan dan log masuk anda" },
		devices: { title: "Peranti yang log masuk", subtitle: "Di mana akaun anda log masuk" },
		appearance: { title: "Penampilan", subtitle: "Pilih rupa aplikasi" },
		appLock: { title: "Kunci aplikasi", subtitle: "Kunci aplikasi apabila anda meninggalkannya" },
		language: { title: "Bahasa", subtitle: "Pilih bahasa aplikasi" },
		components: { title: "Komponen", subtitle: "Kit UI, secara langsung" },
		till: { title: "Kaunter", subtitle: "Imbas dan tebus ganjaran pelanggan" },
		notifications: { title: "Pemberitahuan", subtitle: "Semua yang telah kami beritahu anda" },
		notificationSettings: { title: "Tetapan pemberitahuan", subtitle: "Apa yang sampai kepada anda, dan di mana" },
		pdfViewer: { title: "Pemapar PDF", subtitle: "Baca dokumen" },
		pullRequests: { title: "Permintaan tarik", subtitle: "Permintaan tarik anda yang terbuka dan terkini" },
		pullRequestFiles: { title: "Fail yang diubah", subtitle: "Setiap fail yang diubah, dengan perbezaannya" },
		pullRequestCommits: { title: "Komit", subtitle: "Komit permintaan tarik ini" },
		githubAccount: { title: "Token GitHub", subtitle: "Token yang digunakan aplikasi untuk membaca GitHub" },
		servers: { title: "Pelayan", subtitle: "Setiap mesin tempat platform berjalan" },
		server: { title: "Pelayan", subtitle: "Sejarah dan spesifikasinya" },
	},
	sections: {
		account: "Akaun",
		preferences: "Keutamaan",
		rewards: "Ganjaran",
		documents: "Dokumen",
		developer: "Pembangun",
		github: "GitHub",
		operations: "Operasi",
	},
	drawer: {
		editProfile: "Edit profil",
		signOut: "Log keluar",
	},
	commandPalette: {
		title: "Cari",
		placeholder: "Cari dalam aplikasi",
		empty: "Tiada yang sepadan.",
		goTo: "Pergi ke",
	},

	settings: {
		securityDescription: "Kata laluan, pengesahan dua faktor, kod sandaran",
		tillDescription: "Imbas dan tebus kod QR ganjaran pelanggan",
		pdfViewerDescription: "Baca PDF dari telefon anda",
		about: "Perihal",
		version: "Versi",
		build: "Binaan",
		apiAddress: "Alamat API",
		replayOnboarding: "Log keluar dan ulang pengenalan",
		replayOnboardingHint: "Binaan pembangunan dan ujian sahaja: menunjukkan semula panduan pelancaran pertama",
		signOut: "Log keluar",
		on: "Hidup",
		off: "Mati",
	},
};

const ZH_HANS: NavigationLabels = {
	headings: {
		index: { title: "首页", subtitle: "账户概览" },
		analytics: { title: "分析", subtitle: "您的活动趋势" },
		search: { title: "搜索", subtitle: "在应用中查找任何内容" },
		profile: { title: "个人资料", subtitle: "您的个人信息" },
		settings: { title: "设置", subtitle: "管理您的偏好和账户" },
		security: { title: "安全", subtitle: "您的密码和登录" },
		devices: { title: "已登录的设备", subtitle: "您的账户在哪些设备上登录" },
		appearance: { title: "外观", subtitle: "选择应用的外观" },
		appLock: { title: "应用锁", subtitle: "离开时锁定应用" },
		language: { title: "语言", subtitle: "选择应用的语言" },
		components: { title: "组件", subtitle: "UI 组件库实时预览" },
		till: { title: "收银台", subtitle: "扫描并兑换顾客的奖励" },
		notifications: { title: "通知", subtitle: "我们发给您的所有消息" },
		notificationSettings: { title: "通知设置", subtitle: "您会收到哪些消息，以及在哪里收到" },
		pdfViewer: { title: "PDF 查看器", subtitle: "阅读文档" },
		pullRequests: { title: "拉取请求", subtitle: "您打开的和最近的拉取请求" },
		pullRequestFiles: { title: "已更改的文件", subtitle: "每个更改的文件及其差异" },
		pullRequestCommits: { title: "提交", subtitle: "此拉取请求的提交" },
		githubAccount: { title: "GitHub 令牌", subtitle: "应用用于读取 GitHub 的令牌" },
		servers: { title: "服务器", subtitle: "平台运行所在的每台机器" },
		server: { title: "服务器", subtitle: "历史记录和规格" },
	},
	sections: {
		account: "账户",
		preferences: "偏好设置",
		rewards: "奖励",
		documents: "文档",
		developer: "开发者",
		github: "GitHub",
		operations: "运维",
	},
	drawer: {
		editProfile: "编辑个人资料",
		signOut: "退出登录",
	},
	commandPalette: {
		title: "搜索",
		placeholder: "搜索应用",
		empty: "没有匹配的结果。",
		goTo: "前往",
	},

	settings: {
		securityDescription: "密码、双重验证、备用码",
		tillDescription: "扫描并兑换顾客的奖励二维码",
		pdfViewerDescription: "阅读手机上的 PDF",
		about: "关于",
		version: "版本",
		build: "构建版本",
		apiAddress: "API 地址",
		replayOnboarding: "退出登录并重新播放引导",
		replayOnboardingHint: "仅限开发和测试版本：再次显示首次启动引导",
		signOut: "退出登录",
		on: "开",
		off: "关",
	},
};

const TA: NavigationLabels = {
	headings: {
		index: { title: "முகப்பு", subtitle: "உங்கள் கணக்கு ஒரே பார்வையில்" },
		analytics: { title: "பகுப்பாய்வு", subtitle: "காலப்போக்கில் உங்கள் செயல்பாடு" },
		search: { title: "தேடு", subtitle: "செயலியில் எதையும் கண்டறியுங்கள்" },
		profile: { title: "சுயவிவரம்", subtitle: "உங்கள் தனிப்பட்ட விவரங்கள்" },
		settings: { title: "அமைப்புகள்", subtitle: "உங்கள் விருப்பங்களையும் கணக்கையும் நிர்வகியுங்கள்" },
		security: { title: "பாதுகாப்பு", subtitle: "உங்கள் கடவுச்சொல்லும் உள்நுழைவும்" },
		devices: { title: "உள்நுழைந்த சாதனங்கள்", subtitle: "உங்கள் கணக்கு எங்கெல்லாம் உள்நுழைந்துள்ளது" },
		appearance: { title: "தோற்றம்", subtitle: "செயலி எப்படித் தோன்ற வேண்டும் எனத் தேர்ந்தெடுங்கள்" },
		appLock: { title: "செயலிப் பூட்டு", subtitle: "செயலியை விட்டு வெளியேறும்போது பூட்டுங்கள்" },
		language: { title: "மொழி", subtitle: "செயலியின் மொழியைத் தேர்ந்தெடுங்கள்" },
		components: { title: "கூறுகள்", subtitle: "UI தொகுப்பு, நேரலையில்" },
		till: { title: "கட்டண முனையம்", subtitle: "வாடிக்கையாளர்களின் வெகுமதிகளை ஸ்கேன் செய்து மீட்டெடுங்கள்" },
		notifications: { title: "அறிவிப்புகள்", subtitle: "நாங்கள் உங்களுக்குச் சொன்ன அனைத்தும்" },
		notificationSettings: { title: "அறிவிப்பு அமைப்புகள்", subtitle: "உங்களுக்கு எது, எங்கே வந்து சேரும்" },
		pdfViewer: { title: "PDF பார்வையாளர்", subtitle: "ஓர் ஆவணத்தைப் படியுங்கள்" },
		pullRequests: { title: "இழுப்புக் கோரிக்கைகள்", subtitle: "உங்கள் திறந்த மற்றும் சமீபத்திய இழுப்புக் கோரிக்கைகள்" },
		pullRequestFiles: { title: "மாற்றப்பட்ட கோப்புகள்", subtitle: "மாற்றப்பட்ட ஒவ்வொரு கோப்பும், அதன் வேறுபாட்டுடன்" },
		pullRequestCommits: { title: "கமிட்கள்", subtitle: "இந்த இழுப்புக் கோரிக்கையின் கமிட்கள்" },
		githubAccount: { title: "GitHub டோக்கன்", subtitle: "செயலி GitHub-ஐப் படிக்கப் பயன்படுத்தும் டோக்கன்" },
		servers: { title: "சேவையகங்கள்", subtitle: "தளம் இயங்கும் ஒவ்வொரு இயந்திரமும்" },
		server: { title: "சேவையகம்", subtitle: "அதன் வரலாறும் விவரக்குறிப்பும்" },
	},
	sections: {
		account: "கணக்கு",
		preferences: "விருப்பங்கள்",
		rewards: "வெகுமதிகள்",
		documents: "ஆவணங்கள்",
		developer: "டெவலப்பர்",
		github: "GitHub",
		operations: "செயல்பாடுகள்",
	},
	drawer: {
		editProfile: "சுயவிவரத்தைத் திருத்து",
		signOut: "வெளியேறு",
	},
	commandPalette: {
		title: "தேடல்",
		placeholder: "பயன்பாட்டில் தேடு",
		empty: "எதுவும் பொருந்தவில்லை.",
		goTo: "செல்",
	},

	settings: {
		securityDescription: "கடவுச்சொல், இரு-காரணி அங்கீகாரம், காப்புக் குறியீடுகள்",
		tillDescription: "வாடிக்கையாளர்களின் வெகுமதி QR குறியீடுகளை ஸ்கேன் செய்து மீட்டெடுங்கள்",
		pdfViewerDescription: "உங்கள் தொலைபேசியிலிருந்து ஒரு PDF-ஐப் படியுங்கள்",
		about: "பற்றி",
		version: "பதிப்பு",
		build: "பில்டு",
		apiAddress: "API முகவரி",
		replayOnboarding: "வெளியேறி, அறிமுகத்தை மீண்டும் காட்டு",
		replayOnboardingHint: "மேம்பாட்டு மற்றும் சோதனை பில்டுகளில் மட்டும்: முதல் துவக்க வழிகாட்டியை மீண்டும் காட்டும்",
		signOut: "வெளியேறு",
		on: "இயக்கம்",
		off: "முடக்கம்",
	},
};

export const NAVIGATION_LABELS: LabelPack<NavigationLabels> = { en: EN, ms: MS, "zh-Hans": ZH_HANS, ta: TA };
