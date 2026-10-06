"use client";

import { Button } from "@workspace/ui/components/button";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { useIsClient } from "@workspace/ui/hooks/use-is-client";
import { cn } from "@workspace/ui/lib/core/utils";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";

export interface ShellThemeToggleProps extends Omit<React.ComponentProps<typeof Button>, "children"> {
	/** Per-usage accessible name of the toggle; defaults to the `shellThemeToggle` family's `toggle`. */
	readonly label?: string;
}

/**
 * Light/dark theme toggle for app shell topbars. Hydration-safe: renders a
 * transparent placeholder on the server and during hydration, then the real icon.
 *
 * The theme itself is owned by the app-wide `next-themes` store (the single
 * theme mechanism — rules/07), not by this button, so there is no separate
 * controlled pair: the button reads and writes that store. A caller's
 * `onClick` runs before the toggle.
 */
export const ShellThemeToggle = React.forwardRef<HTMLElement, ShellThemeToggleProps>(function ShellThemeToggle(
	{ label, className, onClick, variant = "ghost", size = "icon", ...props },
	ref,
): React.JSX.Element {
	const labels = useUiKitLabels("shellThemeToggle");
	const { resolvedTheme, setTheme } = useTheme();
	// The resolved theme is only known in the browser: render the placeholder icon
	// on the server and during hydration, the real one after (no mount effect).
	const mounted = useIsClient();

	const handleToggle = React.useCallback<NonNullable<ShellThemeToggleProps["onClick"]>>(
		(event): void => {
			onClick?.(event);
			setTheme(resolvedTheme === "dark" ? "light" : "dark");
		},
		[onClick, resolvedTheme, setTheme],
	);

	return (
		<Button
			ref={ref}
			data-slot="shell-theme-toggle"
			variant={variant}
			size={size}
			onClick={handleToggle}
			aria-label={label ?? labels.toggle}
			className={cn("rounded-full", className)}
			{...props}>
			{mounted ? resolvedTheme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" /> : <Sun className="size-5 opacity-0" aria-hidden="true" />}
		</Button>
	);
});
