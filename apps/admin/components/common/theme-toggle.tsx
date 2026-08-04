"use client";

import { Button } from "@workspace/ui/components/button";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";

/**
 * Light/dark theme toggle. Reads the resolved theme from `next-themes` and
 * flips it on click.
 */
export function ThemeToggle(): React.JSX.Element {
	const { resolvedTheme, setTheme } = useTheme();

	const handleToggle = React.useCallback((): void => {
		setTheme(resolvedTheme === "dark" ? "light" : "dark");
	}, [resolvedTheme, setTheme]);

	return (
		<Button variant="ghost" size="icon" onClick={handleToggle} aria-label="Toggle theme" className="rounded-full">
			{resolvedTheme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
		</Button>
	);
}
