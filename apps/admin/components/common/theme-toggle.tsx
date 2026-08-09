"use client";

import { Button } from "@workspace/ui/components/form/button";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";

/**
 * Light/dark theme toggle. Reads the resolved theme from `next-themes` and
 * flips it on click.
 *
 * Hydration-safe: `resolvedTheme` differs between server ("light" — the
 * default) and the first client render (the user's real theme), so rendering
 * the icon from it directly would mismatch. Instead a transparent placeholder
 * keeps the button's size until one frame after mount, then the real icon
 * swaps in — no hydration error, no size jump.
 */
export function ThemeToggle(): React.JSX.Element {
	const { resolvedTheme, setTheme } = useTheme();
	const [mounted, setMounted] = React.useState(false);

	React.useEffect(() => {
		// rAF-delayed so the state update never runs synchronously inside the
		// effect body (keeps `react-hooks/set-state-in-effect` happy).
		const frame = window.requestAnimationFrame(() => {
			setMounted(true);
		});
		return (): void => {
			window.cancelAnimationFrame(frame);
		};
	}, []);

	const handleToggle = React.useCallback((): void => {
		setTheme(resolvedTheme === "dark" ? "light" : "dark");
	}, [resolvedTheme, setTheme]);

	return (
		<Button variant="ghost" size="icon" onClick={handleToggle} aria-label="Toggle theme" className="rounded-full">
			{mounted ? resolvedTheme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" /> : <Sun className="size-5 opacity-0" aria-hidden="true" />}
		</Button>
	);
}
