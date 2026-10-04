"use client";

import { Button } from "@workspace/ui/components/form/button";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";
import { useIsClient } from "@workspace/ui/hooks/use-is-client";

/**
 * Light/dark theme toggle for app shell topbars. Hydration-safe: renders a
 * transparent placeholder on the server and during hydration, then the real icon.
 */
export function ShellThemeToggle(): React.JSX.Element {
	const { resolvedTheme, setTheme } = useTheme();
	// The resolved theme is only known in the browser: render the placeholder icon
	// on the server and during hydration, the real one after (no mount effect).
	const mounted = useIsClient();

	const handleToggle = React.useCallback((): void => {
		setTheme(resolvedTheme === "dark" ? "light" : "dark");
	}, [resolvedTheme, setTheme]);

	return (
		<Button variant="ghost" size="icon" onClick={handleToggle} aria-label="Toggle theme" className="rounded-full">
			{mounted ? resolvedTheme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" /> : <Sun className="size-5 opacity-0" aria-hidden="true" />}
		</Button>
	);
}
