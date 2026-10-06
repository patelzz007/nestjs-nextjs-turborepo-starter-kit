"use client";

import { UI_KIT_LANGUAGE_PACKS, type UiKitLanguage } from "@workspace/ui/lib/labels/language-packs";
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
	readonly children: React.ReactNode;
}

/** `UiKitLabelsProvider` with a shipped language pack. */
export function UiKitLanguageProvider({ language, children }: UiKitLanguageProviderProps): React.JSX.Element {
	return <UiKitLabelsProvider labels={UI_KIT_LANGUAGE_PACKS[language]}>{children}</UiKitLabelsProvider>;
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
