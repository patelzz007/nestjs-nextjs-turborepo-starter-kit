"use client";

import { nextThemeName, type ThemeName } from "@workspace/tokens";
import { runThemeTransition, themeTransitionOrigin } from "@workspace/ui/lib/core/theme-transition";
import { useTheme } from "next-themes";
import * as React from "react";
import { flushSync } from "react-dom";

/** The shell's theme control — where a hotkey or palette switch starts its reveal from, when it is on screen. */
const SHELL_THEME_TOGGLE_SELECTOR = '[data-slot="shell-theme-toggle"]';

/** A theme a person can choose: one of the token themes (`light`, `dark`, `nord`), or `system` to follow the OS. */
export type ThemeChoice = ThemeName | "system";

export interface ThemeToggle {
	/** The person's choice, `system` included (`undefined` until the browser has read it). */
	readonly theme: string | undefined;
	/** The theme on screen (`undefined` until the browser has resolved it). */
	readonly resolvedTheme: string | undefined;
	/**
	 * Switches to `choice` with the circular reveal. It grows from `origin` (the control the
	 * person used); without one, from the shell's theme control, or the top-right corner.
	 */
	readonly chooseTheme: (choice: ThemeChoice, origin?: Element | null) => void;
	/** Moves to the next theme (light → dark → Nord → light) with the same reveal — the `D` hotkey and the command palettes. */
	readonly toggleTheme: (origin?: Element | null) => void;
}

/**
 * The one way the apps switch themes: the shell's theme menu, the `D` hotkey and every
 * command palette call this, so all of them animate the same way. The theme itself stays
 * owned by `next-themes` (rules/07).
 */
export function useThemeToggle(): ThemeToggle {
	const { theme, resolvedTheme, setTheme } = useTheme();

	const chooseTheme = React.useCallback(
		(choice: ThemeChoice, origin?: Element | null): void => {
			const from = origin ?? document.querySelector(SHELL_THEME_TOGGLE_SELECTOR);
			// `flushSync` commits the theme (and next-themes' class effect) before the browser
			// takes the "new" snapshot, so the reveal shows the new theme, not the old one.
			runThemeTransition((): void => {
				flushSync((): void => {
					setTheme(choice);
				});
			}, themeTransitionOrigin(from));
		},
		[setTheme],
	);

	const toggleTheme = React.useCallback(
		(origin?: Element | null): void => {
			chooseTheme(nextThemeName(resolvedTheme), origin);
		},
		[chooseTheme, resolvedTheme],
	);

	return { theme, resolvedTheme, chooseTheme, toggleTheme };
}
