/**
 * Copy interfaces of the app-shell chrome label families
 * (`appShellTopbarSearch`, `appShellProfileDropdown` in `UiKitLabels`;
 * `shellThemeToggle` and `scrollToTop` are defined in
 * `lib/labels/ui-kit-labels.ts`). The strings themselves live in the language
 * packs (`lib/labels/en.ts`, …); components read them with `useUiKitLabels`.
 */

/** The topbar's search trigger. */
export interface AppShellTopbarSearchLabels {
	/** Its word and accessible name, "Search": shown from `sm` up, read (not shown) on a phone. */
	readonly mobileAriaLabel: string;
}

export interface AppShellProfileDropdownLabels {
	/** Accessible name of the avatar trigger. */
	readonly openMenuAriaLabel: string;
	readonly logout: string;
}
