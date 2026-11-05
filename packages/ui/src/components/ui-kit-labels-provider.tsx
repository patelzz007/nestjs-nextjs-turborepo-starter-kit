"use client";

import { loadUiKitLanguagePack, readyUiKitLanguagePack, type UiKitLanguage } from "@workspace/ui/lib/labels/language-packs";
import type { UiKitLabelFamily, UiKitLabels, UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import * as React from "react";

const UiKitLabelsContext = React.createContext<UiKitLabels | null>(null);

export interface UiKitLabelsProviderProps {
	/** A complete label set — a shipped pack, or one extended with product wording. Keep it a module constant. */
	readonly labels: UiKitLabels;
	readonly children: React.ReactNode;
}

/** Supplies every kit component below it with its copy (see `UiKitLabels`). Mount once, at the app root. */
export function UiKitLabelsProvider({ labels, children }: UiKitLabelsProviderProps): React.JSX.Element {
	return <UiKitLabelsContext.Provider value={labels}>{children}</UiKitLabelsContext.Provider>;
}

export interface UiKitLanguageProviderProps {
	/** A shipped language pack by name — serializable, so a Server Component layout can choose it. */
	readonly language: UiKitLanguage;
	/**
	 * How the app switches language (ADR 076): set its preference and re-render. Optional: without it the
	 * language menu (`ShellLanguageToggle`) doesn't render, so a surface can be fixed to one language.
	 */
	readonly onLanguageChange?: ((language: UiKitLanguage) => void) | undefined;
	readonly children: React.ReactNode;
}

/** The language on screen and, when the app allows it, how to change it. */
export interface UiKitLanguageState {
	readonly language: UiKitLanguage;
	readonly chooseLanguage: ((language: UiKitLanguage) => void) | null;
}

const UiKitLanguageContext = React.createContext<UiKitLanguageState | null>(null);

/**
 * `UiKitLabelsProvider` with a shipped language pack, and the language for `useUiKitLanguage`. English, and
 * any pack already loaded, is at hand; another pack is loaded on demand and waited for once (`React.use`):
 * on the server that wait ends before the HTML is sent, so the first paint is already in the reader's language.
 */
export function UiKitLanguageProvider({ language, onLanguageChange, children }: UiKitLanguageProviderProps): React.JSX.Element {
	const state = React.useMemo((): UiKitLanguageState => ({ language, chooseLanguage: onLanguageChange ?? null }), [language, onLanguageChange]);
	const labels = readyUiKitLanguagePack(language) ?? React.use(loadUiKitLanguagePack(language));
	return (
		<UiKitLanguageContext.Provider value={state}>
			<UiKitLabelsProvider labels={labels}>{children}</UiKitLabelsProvider>
		</UiKitLanguageContext.Provider>
	);
}

/** The language on screen and how to change it; `null` outside a `UiKitLanguageProvider` (a bare labels provider). */
export function useUiKitLanguage(): UiKitLanguageState | null {
	return React.useContext(UiKitLanguageContext);
}

/**
 * A component family's copy from the nearest `UiKitLabelsProvider`, with the
 * component's own `labels` prop (if any) laid over it. Throws without a
 * provider: the kit has no built-in copy to fall back to, and a missing
 * provider should fail loudly rather than render blank controls.
 */
export function useUiKitLabels<Family extends UiKitLabelFamily>(family: Family, override?: UiKitLabelsOverride<Family>): UiKitLabels[Family] {
	const labels = React.useContext(UiKitLabelsContext);
	const resolved = React.useMemo((): UiKitLabels[Family] | null => {
		if (labels === null) {
			return null;
		}
		return override === undefined ? labels[family] : { ...labels[family], ...override };
	}, [family, labels, override]);
	if (resolved === null) {
		throw new Error(`No UiKitLabelsProvider above a component that needs "${family}" labels — mount UiKitLabelsProvider at the app root.`);
	}
	return resolved;
}
