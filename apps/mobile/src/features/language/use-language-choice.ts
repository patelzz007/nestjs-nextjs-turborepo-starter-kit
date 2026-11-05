// ============================================
// use-language-choice.ts - choosing the app's language (Settings → Language)
// ============================================
// The choice applies on this device at once (saved in Secure Store) and is saved on the signed-in
// person's profile (`PUT /auth/profile/language`), so their other devices and their notifications
// follow it (ADR 076 §3). The profile save is best-effort, as on the web: the language has already
// changed on screen, and a refused save (an impersonation session may not change the profile)
// changes nothing here.

import type { AppLanguage } from "@workspace/shared";
import * as React from "react";

import { useApi } from "../../lib/api-context";
import { usePreferencesCommands } from "../preferences/facade";
import { useAppLanguage } from "./use-app-language";

export interface LanguageChoice {
	/** The language on screen. */
	readonly language: AppLanguage;
	readonly choose: (language: AppLanguage) => void;
}

export function useLanguageChoice(): LanguageChoice {
	const language = useAppLanguage();
	const { languageChanged } = usePreferencesCommands();
	const { mutate: saveOnProfile } = useApi().auth.setLanguage.useMutation();
	const choose = React.useCallback(
		(next: AppLanguage): void => {
			languageChanged(next);
			saveOnProfile({ language: next });
		},
		[languageChanged, saveOnProfile],
	);
	return { language, choose };
}
