/**
 * Copy interfaces of the app-shell chrome label families
 * (`appShellTopbarSearch`, `appShellProfileDropdown` in `UiKitLabels`;
 * `shellThemeToggle` and `scrollToTop` are defined in
 * `lib/labels/ui-kit-labels.ts`). The strings themselves live in the language
 * packs (`lib/labels/en.ts`, …); components read them with `useUiKitLabels`.
 */

/** Accessible names of the topbar's search triggers. */
export interface AppShellTopbarSearchLabels {
	/** The icon-only trigger shown below `md`. */
	readonly mobileAriaLabel: string;
	/** The wide trigger shown at `md`+. */
	readonly desktopAriaLabel: string;
}

export interface AppShellProfileDropdownLabels {
	/** Accessible name of the avatar trigger. */
	readonly openMenuAriaLabel: string;
	readonly logout: string;
}
