// ============================================
// labels.ts - the app lock's words in every shipped language (ADR 076)
// ============================================
// The App lock settings screen, the lock screen, and the prompts the OS shows over them. Apple's own
// names stay as they are (Face ID, Touch ID; 面容 ID and 触控 ID in Simplified Chinese).

import type { LabelPack } from "../language/label-pack";

export interface AppLockLabels {
	/** Settings → App lock. */
	readonly settings: {
		readonly description: string;
		readonly isOn: string;
		readonly isOff: string;
		readonly turnOn: string;
		readonly turnOff: string;
		readonly deviceOnly: string;
		readonly lockAfter: string;
		readonly expoGoNote: string;
		/** The device has no passcode (or biometrics), so the lock cannot be turned on. */
		readonly unavailable: string;
		readonly failed: string;
		/** What the OS prompt says while turning the lock on, and off. */
		readonly confirmTurnOn: string;
		readonly confirmTurnOff: string;
	};
	/** The lock screen over a signed-in session. */
	readonly lock: {
		readonly title: (appName: string) => string;
		readonly body: string;
		/** What the OS prompt says. */
		readonly prompt: string;
		readonly failed: string;
		readonly unavailable: string;
		readonly tryAgain: string;
		readonly signOut: string;
	};
}

const EN: AppLockLabels = {
	settings: {
		description: "Ask for Face ID, Touch ID, your fingerprint or the device passcode before the app opens.",
		isOn: "The app lock is on.",
		isOff: "The app lock is off.",
		turnOn: "Turn on app lock",
		turnOff: "Turn off app lock",
		deviceOnly: "The lock works on this device only. If the biometrics on this device change, it turns itself off and you sign in with your password again.",
		lockAfter: "Lock after",
		expoGoNote: "In Expo Go on iPhone the lock uses your device passcode instead of Face ID; a real build uses Face ID.",
		unavailable: "Set up a device passcode (and biometrics, if you like) in your phone's settings to use the app lock.",
		failed: "The check didn't pass, so nothing changed. Try again.",
		confirmTurnOn: "Confirm to turn on the app lock",
		confirmTurnOff: "Confirm to turn off the app lock",
	},
	lock: {
		title: (appName: string): string => `${appName} is locked`,
		body: "Unlock with Face ID, Touch ID, your fingerprint or your device passcode.",
		prompt: "Unlock to continue",
		failed: "The check didn't pass. Try again, or sign out.",
		unavailable: "This device can't check its owner right now (no passcode or biometrics set up). Sign out and sign in with your password.",
		tryAgain: "Try again",
		signOut: "Sign out",
	},
};

const MS: AppLockLabels = {
	settings: {
		description: "Minta Face ID, Touch ID, cap jari anda atau kod laluan peranti sebelum aplikasi dibuka.",
		isOn: "Kunci aplikasi sedang aktif.",
		isOff: "Kunci aplikasi tidak aktif.",
		turnOn: "Hidupkan kunci aplikasi",
		turnOff: "Matikan kunci aplikasi",
		deviceOnly:
			"Kunci ini berfungsi pada peranti ini sahaja. Jika biometrik pada peranti ini berubah, kunci akan dimatikan sendiri dan anda perlu log masuk semula dengan kata laluan.",
		lockAfter: "Kunci selepas",
		expoGoNote: "Dalam Expo Go pada iPhone, kunci menggunakan kod laluan peranti dan bukannya Face ID; binaan sebenar menggunakan Face ID.",
		unavailable: "Tetapkan kod laluan peranti (dan biometrik, jika mahu) dalam tetapan telefon anda untuk menggunakan kunci aplikasi.",
		failed: "Semakan tidak lulus, jadi tiada apa-apa yang berubah. Cuba lagi.",
		confirmTurnOn: "Sahkan untuk menghidupkan kunci aplikasi",
		confirmTurnOff: "Sahkan untuk mematikan kunci aplikasi",
	},
	lock: {
		title: (appName: string): string => `${appName} dikunci`,
		body: "Buka kunci dengan Face ID, Touch ID, cap jari anda atau kod laluan peranti anda.",
		prompt: "Buka kunci untuk meneruskan",
		failed: "Semakan tidak lulus. Cuba lagi, atau log keluar.",
		unavailable: "Peranti ini tidak dapat menyemak pemiliknya sekarang (tiada kod laluan atau biometrik ditetapkan). Log keluar dan log masuk dengan kata laluan anda.",
		tryAgain: "Cuba lagi",
		signOut: "Log keluar",
	},
};

const ZH_HANS: AppLockLabels = {
	settings: {
		description: "在打开应用前要求使用面容 ID、触控 ID、指纹或设备密码。",
		isOn: "应用锁已开启。",
		isOff: "应用锁已关闭。",
		turnOn: "开启应用锁",
		turnOff: "关闭应用锁",
		deviceOnly: "此锁仅在此设备上有效。如果此设备上的生物识别信息发生变化，它会自动关闭，您需要重新使用密码登录。",
		lockAfter: "锁定时间",
		expoGoNote: "在 iPhone 上的 Expo Go 中，此锁使用设备密码而非面容 ID；正式构建版本会使用面容 ID。",
		unavailable: "请在手机设置中设置设备密码（如有需要，也可设置生物识别），以使用应用锁。",
		failed: "验证未通过，因此没有任何更改。请重试。",
		confirmTurnOn: "确认以开启应用锁",
		confirmTurnOff: "确认以关闭应用锁",
	},
	lock: {
		title: (appName: string): string => `${appName} 已锁定`,
		body: "使用面容 ID、触控 ID、指纹或设备密码解锁。",
		prompt: "解锁以继续",
		failed: "验证未通过。请重试或退出登录。",
		unavailable: "此设备目前无法验证机主身份（未设置密码或生物识别）。请退出登录，然后使用密码登录。",
		tryAgain: "重试",
		signOut: "退出登录",
	},
};

const TA: AppLockLabels = {
	settings: {
		description: "செயலி திறக்கும் முன் Face ID, Touch ID, உங்கள் கைரேகை அல்லது சாதனக் கடவுக்குறியீட்டைக் கேட்கும்.",
		isOn: "செயலிப் பூட்டு இயக்கத்தில் உள்ளது.",
		isOff: "செயலிப் பூட்டு முடக்கத்தில் உள்ளது.",
		turnOn: "செயலிப் பூட்டை இயக்கு",
		turnOff: "செயலிப் பூட்டை முடக்கு",
		deviceOnly: "இந்தப் பூட்டு இந்தச் சாதனத்தில் மட்டுமே செயல்படும். இந்தச் சாதனத்தின் பயோமெட்ரிக்ஸ் மாறினால், அது தானாகவே முடங்கும்; நீங்கள் உங்கள் கடவுச்சொல்லுடன் மீண்டும் உள்நுழைய வேண்டும்.",
		lockAfter: "பூட்டும் நேரம்",
		expoGoNote: "iPhone-இல் Expo Go-வில் இந்தப் பூட்டு Face ID-க்குப் பதிலாக உங்கள் சாதனக் கடவுக்குறியீட்டைப் பயன்படுத்தும்; உண்மையான பில்டு Face ID-ஐப் பயன்படுத்தும்.",
		unavailable: "செயலிப் பூட்டைப் பயன்படுத்த, உங்கள் தொலைபேசி அமைப்புகளில் ஒரு சாதனக் கடவுக்குறியீட்டை (விரும்பினால் பயோமெட்ரிக்ஸையும்) அமையுங்கள்.",
		failed: "சரிபார்ப்பு வெற்றிபெறவில்லை, எனவே எதுவும் மாறவில்லை. மீண்டும் முயல்க.",
		confirmTurnOn: "செயலிப் பூட்டை இயக்க உறுதிசெய்யுங்கள்",
		confirmTurnOff: "செயலிப் பூட்டை முடக்க உறுதிசெய்யுங்கள்",
	},
	lock: {
		title: (appName: string): string => `${appName} பூட்டப்பட்டுள்ளது`,
		body: "Face ID, Touch ID, உங்கள் கைரேகை அல்லது சாதனக் கடவுக்குறியீட்டைக் கொண்டு திறங்கள்.",
		prompt: "தொடர திறங்கள்",
		failed: "சரிபார்ப்பு வெற்றிபெறவில்லை. மீண்டும் முயலுங்கள், அல்லது வெளியேறுங்கள்.",
		unavailable: "இந்தச் சாதனத்தால் இப்போது அதன் உரிமையாளரைச் சரிபார்க்க முடியவில்லை (கடவுக்குறியீடு அல்லது பயோமெட்ரிக்ஸ் அமைக்கப்படவில்லை). வெளியேறி, உங்கள் கடவுச்சொல்லுடன் உள்நுழையுங்கள்.",
		tryAgain: "மீண்டும் முயல்க",
		signOut: "வெளியேறு",
	},
};

export const APP_LOCK_LABELS: LabelPack<AppLockLabels> = { en: EN, ms: MS, "zh-Hans": ZH_HANS, ta: TA };
