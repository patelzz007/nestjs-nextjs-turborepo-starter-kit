"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import * as React from "react";

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

function ThemeHotkey(): null {
	const { resolvedTheme, setTheme } = useTheme();

	React.useEffect(() => {
		function onKeyDown(event: KeyboardEvent): void {
			if (event.defaultPrevented || event.repeat) {
				return;
			}

			if (event.metaKey || event.ctrlKey || event.altKey) {
				return;
			}

			if (event.key.toLowerCase() !== "d") {
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
