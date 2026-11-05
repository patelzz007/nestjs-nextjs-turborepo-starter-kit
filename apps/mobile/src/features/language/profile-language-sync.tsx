// ============================================
// profile-language-sync.tsx - the person's saved language, on a device that hasn't chosen one
// ============================================
// ADR 076 §3 (amended for 5.2): the device's own choice wins; on a device that has not chosen, the
// signed-in person's saved language (`OwnProfile.language`) applies after sign-in and becomes this
// device's choice — the web's `ProfileLanguageSync`. A saved language already on screen changes nothing.
// Rendered as its own leaf (`ProfileLanguageSync`, renders nothing), so the profile query's updates
// re-render only it, never the app shell and the tabs under it. Mounted once by the signed-in app shell.

import * as React from "react";

import { useApi } from "../../lib/api-context";
import { useLanguagePreference, usePreferencesCommands } from "../preferences/facade";
import { useAppLanguage } from "./use-app-language";

export function useProfileLanguageSync(): void {
	const chosen = useLanguagePreference();
	const shown = useAppLanguage();
	const { languageChanged } = usePreferencesCommands();
	const saved = useApi().auth.profile.useQuery(undefined, { enabled: chosen === null }).data?.data.language;

	React.useEffect((): void => {
		// Already on screen (the phone's language is the saved one): nothing to apply, as on the web.
		if (chosen === null && saved !== undefined && saved !== shown) {
			languageChanged(saved);
		}
	}, [chosen, languageChanged, saved, shown]);
}

/** Keeps the signed-in person's saved language and this device's in step. Renders nothing. */
export function ProfileLanguageSync(): null {
	useProfileLanguageSync();
	return null;
}
