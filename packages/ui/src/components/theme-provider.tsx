"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import * as React from "react";

/**
 * Shared theme provider for web, admin, and merchant.
 *
 * `next-themes` injects a blocking inline `<script>` to prevent theme flash.
 * React 19 / Next 16 warn when that script re-renders on the client. We patch
 * `next-themes@0.4.6` (see `patches/next-themes@0.4.6.patch`) so ThemeScript
 * only renders during SSR.
 */
function ThemeProvider({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>): React.JSX.Element {
	return (
		<NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange {...props}>
			<ThemeHotkey />
			{children}
		</NextThemesProvider>
	);
}

function isTypingTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) {
		return false;
	}

	return target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

/**
 * Minimal shape of the keydown event as observed at runtime.
 *
 * `key` is typed optional because some synthetic / polyfilled events reach the
 * listener without a populated `key` — guarding on it is therefore necessary
 * (it also keeps the strict lint rules happy, which would reject a guard on
 * the DOM-lib `KeyboardEvent.key` since that type says it's always a string).
 * Real `KeyboardEvent`s satisfy this interface structurally, so the listener
 * stays assignable to `window.addEventListener("keydown", …)`.
 */
interface ThemeHotkeyKeyDownEvent {
	readonly defaultPrevented: boolean;
	readonly repeat: boolean;
	readonly metaKey: boolean;
	readonly ctrlKey: boolean;
	readonly altKey: boolean;
	readonly key?: string;
	readonly target: EventTarget | null;
}

function ThemeHotkey(): null {
	const { resolvedTheme, setTheme } = useTheme();

	React.useEffect(() => {
		function onKeyDown(event: ThemeHotkeyKeyDownEvent): void {
			if (event.defaultPrevented || event.repeat) {
				return;
			}

			if (event.metaKey || event.ctrlKey || event.altKey) {
				return;
			}

			// Defensive: some synthetic / polyfilled events reach the listener
			// without a populated `key` — treat them as a no-op instead of crashing.
			if (event.key?.toLowerCase() !== "d") {
				return;
			}

			if (isTypingTarget(event.target)) {
				return;
			}

			setTheme(resolvedTheme === "dark" ? "light" : "dark");
		}

		window.addEventListener("keydown", onKeyDown);
		return (): void => {
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [resolvedTheme, setTheme]);

	return null;
}

export { ThemeProvider };
