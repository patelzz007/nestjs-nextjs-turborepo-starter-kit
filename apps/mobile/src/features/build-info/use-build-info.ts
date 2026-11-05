// ============================================
// use-build-info.ts - the running build, in words (owner, 2026-11-05)
// ============================================
// Which build this is (development, preview, production, or a local release), its version, and when
// its code was made, in the phone's own time zone and the language on screen. The drawer's footer,
// the sign-in panel and Settings → About all read it, so they always agree.

import * as React from "react";

import { formatBuildMoment, resolveBuildMoment, type BuildIdentity, type BuildKind } from "../../lib/build-identity";
import { useAppLanguage } from "../language/use-app-language";
import { useReadyRuntime } from "../../runtime/runtime-context";
import { BUILD_INFO_LABELS } from "./labels";

export interface BuildInfoMoment {
	/** "Built", "Updated" or "Installed". */
	readonly word: string;
	/** "5 Nov 2026, 6:12 pm GMT+8". */
	readonly when: string;
	/** Both together: "Built 5 Nov 2026, 6:12 pm GMT+8". */
	readonly line: string;
}

export interface BuildInfo {
	readonly kind: BuildKind;
	/** "Preview build". */
	readonly kindLabel: string;
	/** "Version 1.0.0 (3)". */
	readonly version: string;
	/** "Preview build · Version 1.0.0 (3)". */
	readonly summary: string;
	/** `null` while the install time loads, or where no moment is known (Expo Go). */
	readonly moment: BuildInfoMoment | null;
}

/** The install time, read only when no update says when the code was made (a development build). */
function useInstalledAt(build: BuildIdentity): Date | null {
	const [installedAt, setInstalledAt] = React.useState<Date | null>(null);
	React.useEffect((): (() => void) => {
		let active = true;
		if (build.runningUpdateCreatedAt === null) {
			build
				.readInstalledAt()
				.then((at: Date | null): void => {
					if (active) {
						setInstalledAt(at);
					}
				})
				.catch((): void => {
					// Not known on this device: the line shows the build type and version only.
				});
		}
		return (): void => {
			active = false;
		};
	}, [build]);
	return installedAt;
}

export function useBuildInfo(): BuildInfo {
	const { appVersion, buildNumber, build } = useReadyRuntime();
	const language = useAppLanguage();
	const labels = BUILD_INFO_LABELS[language];
	const installedAt = useInstalledAt(build);
	const moment = resolveBuildMoment({ runningUpdateCreatedAt: build.runningUpdateCreatedAt, isEmbeddedLaunch: build.isEmbeddedLaunch, installedAt });
	const kindLabel = labels.kinds[build.kind];
	const version = labels.version(appVersion, buildNumber);
	let shownMoment: BuildInfoMoment | null = null;
	if (moment !== null) {
		const word = labels.moments[moment.kind];
		const when = formatBuildMoment(moment.at, language);
		shownMoment = { word, when, line: labels.moment(word, when) };
	}
	return { kind: build.kind, kindLabel, version, summary: labels.summary(kindLabel, version), moment: shownMoment };
}
