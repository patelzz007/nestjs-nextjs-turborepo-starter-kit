"use client";

import { UiKitLanguageProvider } from "@workspace/ui/components/ui-kit-labels-provider";
import type { UiKitLanguage } from "@workspace/ui/lib/labels/language-packs";
import { useRouter } from "next/navigation";
import * as React from "react";

import { LANGUAGE_COOKIE } from "./ui-kit-language";

/** A language choice is remembered for a year (a preference, never an authorization input). */
export const LANGUAGE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** The `document.cookie` assignment that remembers `language`; `Secure` whenever the page is served over https. */
export function languageCookieAssignment(language: UiKitLanguage, secure: boolean): string {
	const parts = [`${LANGUAGE_COOKIE}=${encodeURIComponent(language)}`, "path=/", `max-age=${String(LANGUAGE_COOKIE_MAX_AGE_SECONDS)}`, "samesite=lax"];
	return (secure ? [...parts, "secure"] : parts).join("; ");
}

/** Whether this device has chosen a language itself (the `lang` cookie), read from a `document.cookie` string. */
export function hasLanguageCookie(cookieHeader: string): boolean {
	return cookieHeader.split(";").some((part: string): boolean => part.trim().startsWith(`${LANGUAGE_COOKIE}=`));
}

/** A language choice made in the menu. */
export type LanguageChosenListener = (language: UiKitLanguage) => void;

/**
 * What the signed-in part of an app needs from the language (enhancement 5.2): to hear each choice made in the
 * menu (to save it on the profile), and to apply a language without it counting as a new choice (the saved one,
 * after sign-in).
 */
export interface AppLanguageChoices {
	readonly onChosen: (listener: LanguageChosenListener) => () => void;
	readonly apply: (language: UiKitLanguage) => void;
}

const AppLanguageChoicesContext = React.createContext<AppLanguageChoices | null>(null);

/** The app's language choices; null outside an `AppLanguageProvider`. */
export function useAppLanguageChoices(): AppLanguageChoices | null {
	return React.useContext(AppLanguageChoicesContext);
}

export interface AppLanguageProviderProps {
	/** The language the root layout resolved for this request (`readRequestLanguage`). */
	readonly language: UiKitLanguage;
	readonly children: React.ReactNode;
}

/**
 * The app's language (ADR 076): the UI kit pack for `language`, and the language menu's action — remember
 * the choice in the `lang` cookie, then re-render the page on the server in the new language. The signed-in
 * part of the app hears each choice (`useAppLanguageChoices`) to save it on the person's profile (5.2).
 */
export function AppLanguageProvider({ language, children }: AppLanguageProviderProps): React.JSX.Element {
	const router = useRouter();
	const [listeners] = React.useState((): Set<LanguageChosenListener> => new Set<LanguageChosenListener>());
	const apply = React.useCallback(
		(next: UiKitLanguage): void => {
			document.cookie = languageCookieAssignment(next, window.location.protocol === "https:");
			router.refresh();
		},
		[router],
	);
	const chooseLanguage = React.useCallback(
		(next: UiKitLanguage): void => {
			apply(next);
			for (const listener of listeners) {
				listener(next);
			}
		},
		[apply, listeners],
	);
	const choices = React.useMemo(
		(): AppLanguageChoices => ({
			onChosen: (listener: LanguageChosenListener): (() => void) => {
				listeners.add(listener);
				return (): void => {
					listeners.delete(listener);
				};
			},
			apply,
		}),
		[apply, listeners],
	);
	return (
		<AppLanguageChoicesContext.Provider value={choices}>
			<UiKitLanguageProvider language={language} onLanguageChange={chooseLanguage}>
				{children}
			</UiKitLanguageProvider>
		</AppLanguageChoicesContext.Provider>
	);
}
