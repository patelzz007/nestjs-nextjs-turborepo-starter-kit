// ============================================
// use-app-language.ts - the language on screen, and a surface's copy in it
// ============================================
// The order of ADR 076 §3 on a phone: this device's own choice (Settings → Language, saved in Secure
// Store), then the phone's language (expo-localization, which follows a change made in the phone's
// settings while the app runs). On the starter kit, a device that hasn't chosen takes the signed-in
// person's saved language after sign-in (`profile-language-sync.tsx`), which becomes its choice.

import type { AppLanguage } from "@workspace/shared";
import { useLocales } from "expo-localization";

import { useLanguagePreference } from "../preferences/facade";
import { deviceLanguageOf } from "./device-language";
import type { LabelPack } from "./label-pack";

export function useAppLanguage(): AppLanguage {
	const chosen = useLanguagePreference();
	const locales = useLocales();
	return chosen ?? deviceLanguageOf(locales);
}

/** `pack` in the language on screen. */
export function useLabels<TLabels>(pack: LabelPack<TLabels>): TLabels {
	return pack[useAppLanguage()];
}
