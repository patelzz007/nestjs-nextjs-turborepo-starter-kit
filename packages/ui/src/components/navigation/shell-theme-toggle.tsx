"use client";

import { Button } from "@workspace/ui/components/form/button";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";

/**
 * Light/dark theme toggle for app shell topbars. Hydration-safe: renders a
 * transparent placeholder until one frame after mount, then shows the real icon.
 */
export function ShellThemeToggle(): React.JSX.Element {
	const { resolvedTheme, setTheme } = useTheme();
	const [mounted, setMounted] = React.useState<boolean>(false);

	React.useEffect((): (() => void) => {
		const frame = window.requestAnimationFrame((): void => {
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
