// ============================================
// navigation-theme.tsx — the navigators' colours, from the design tokens (ADR 044)
// ============================================
// React Navigation paints every screen container, card and transition backdrop
// in its own theme's colours — white unless told otherwise. In dark mode that
// white showed for a frame on every navigation (the "white flicker"). This
// provider gives the navigators the token colours of the theme on screen, and
// paints the native root window the same, so nothing behind a moving screen is
// ever a different colour from the page.

import * as SystemUI from "expo-system-ui";
import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router";
import * as React from "react";
import { useCSSVariable, useUniwind } from "uniwind";
import { z } from "zod";

export type NavigationTheme = NonNullable<React.ComponentProps<typeof ThemeProvider>["value"]>;

const ColorSchema = z.string();

/** A token colour as a string, or the fallback while the stylesheet has not resolved it. */
function colorOr(value: string | number | undefined, fallback: string): string {
	return ColorSchema.safeParse(value).data ?? fallback;
}

/** The theme on screen, as React Navigation wants it: its own light or dark base, with the token colours. */
export function useNavigationTheme(): NavigationTheme {
	const { theme } = useUniwind();
	const base = theme === "dark" ? DarkTheme : DefaultTheme;
	const background = useCSSVariable("--background");
	const card = useCSSVariable("--card");
	const text = useCSSVariable("--foreground");
	const border = useCSSVariable("--border");
	const primary = useCSSVariable("--primary");
	const notification = useCSSVariable("--destructive");

	return React.useMemo(
		(): NavigationTheme => ({
			...base,
			colors: {
				background: colorOr(background, String(base.colors.background)),
				card: colorOr(card, String(base.colors.card)),
				text: colorOr(text, String(base.colors.text)),
				border: colorOr(border, String(base.colors.border)),
				primary: colorOr(primary, String(base.colors.primary)),
				notification: colorOr(notification, String(base.colors.notification)),
			},
		}),
		[background, base, border, card, notification, primary, text],
	);
}

export interface NavigationThemeProviderProps {
	readonly children: React.ReactNode;
}

export function NavigationThemeProvider({ children }: NavigationThemeProviderProps): React.JSX.Element {
	const theme = useNavigationTheme();
	const background = String(theme.colors.background);

	// The native root window shows through during transitions and the keyboard's animation.
	React.useEffect((): void => {
		SystemUI.setBackgroundColorAsync(background).catch((): void => {
			// Not available (web, tests): the navigators' own backgrounds still cover it.
		});
	}, [background]);

	return <ThemeProvider value={theme}>{children}</ThemeProvider>;
}
