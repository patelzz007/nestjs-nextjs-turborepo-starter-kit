// ============================================
// labels.ts - the build line's words in every shipped language (ADR 076)
// ============================================
// The drawer's footer, the sign-in panel and Settings → About name the build the same way:
// "Preview build · Version 1.0.0 (3)" and "Built 5 Nov 2026, 6:12 pm GMT+8".

import type { BuildKind, BuildMomentKind } from "../../lib/build-identity";
import type { LabelPack } from "../language/label-pack";

export interface BuildInfoLabels {
	/** Settings → About's row for the build type. */
	readonly buildType: string;
	readonly kinds: Readonly<Record<BuildKind, string>>;
	/** The moment's own word, as Settings → About's row label. */
	readonly moments: Readonly<Record<BuildMomentKind, string>>;
	readonly version: (appVersion: string, buildNumber: string | null) => string;
	/** The first line: the build type and the version. */
	readonly summary: (kind: string, version: string) => string;
	/** The second line: the moment's word and when. */
	readonly moment: (word: string, when: string) => string;
}

const EN: BuildInfoLabels = {
	buildType: "Build type",
	kinds: { development: "Development build", preview: "Preview build", production: "Production build", local: "Local release build" },
	moments: { built: "Built", updated: "Updated", installed: "Installed" },
	version: (appVersion: string, buildNumber: string | null): string => (buildNumber === null ? `Version ${appVersion}` : `Version ${appVersion} (${buildNumber})`),
	summary: (kind: string, version: string): string => `${kind} · ${version}`,
	moment: (word: string, when: string): string => `${word} ${when}`,
};

const MS: BuildInfoLabels = {
	buildType: "Jenis binaan",
	kinds: { development: "Binaan pembangunan", preview: "Binaan pratonton", production: "Binaan pengeluaran", local: "Binaan keluaran tempatan" },
	moments: { built: "Dibina", updated: "Dikemas kini", installed: "Dipasang" },
	version: (appVersion: string, buildNumber: string | null): string => (buildNumber === null ? `Versi ${appVersion}` : `Versi ${appVersion} (${buildNumber})`),
	summary: (kind: string, version: string): string => `${kind} · ${version}`,
	moment: (word: string, when: string): string => `${word} ${when}`,
};

const ZH_HANS: BuildInfoLabels = {
	buildType: "构建类型",
	kinds: { development: "开发版", preview: "预览版", production: "正式版", local: "本地发布版" },
	moments: { built: "构建于", updated: "更新于", installed: "安装于" },
	version: (appVersion: string, buildNumber: string | null): string => (buildNumber === null ? `版本 ${appVersion}` : `版本 ${appVersion}（${buildNumber}）`),
	summary: (kind: string, version: string): string => `${kind} · ${version}`,
	moment: (word: string, when: string): string => `${word} ${when}`,
};

const TA: BuildInfoLabels = {
	buildType: "பில்டு வகை",
	kinds: { development: "மேம்பாட்டு பில்டு", preview: "முன்னோட்ட பில்டு", production: "தயாரிப்பு பில்டு", local: "உள்ளூர் வெளியீட்டு பில்டு" },
	moments: { built: "உருவாக்கப்பட்டது", updated: "புதுப்பிக்கப்பட்டது", installed: "நிறுவப்பட்டது" },
	version: (appVersion: string, buildNumber: string | null): string => (buildNumber === null ? `பதிப்பு ${appVersion}` : `பதிப்பு ${appVersion} (${buildNumber})`),
	summary: (kind: string, version: string): string => `${kind} · ${version}`,
	moment: (word: string, when: string): string => `${word}: ${when}`,
};

export const BUILD_INFO_LABELS: LabelPack<BuildInfoLabels> = { en: EN, ms: MS, "zh-Hans": ZH_HANS, ta: TA };
