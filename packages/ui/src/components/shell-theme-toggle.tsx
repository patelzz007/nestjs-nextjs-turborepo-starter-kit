"use client";

import { THEME_NAMES, type ThemeName } from "@workspace/tokens";
import { Button } from "@workspace/ui/components/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { useIsClient } from "@workspace/ui/hooks/use-is-client";
import { type ThemeChoice, useThemeToggle } from "@workspace/ui/hooks/use-theme-toggle";
import { mergeRefs } from "@workspace/ui/lib/core/merge-refs";
import { cn } from "@workspace/ui/lib/core/utils";
import { type LucideIcon, Monitor, Moon, Snowflake, Sun } from "lucide-react";
import * as React from "react";

export interface ShellThemeToggleProps extends Omit<React.ComponentProps<typeof Button>, "children"> {
	/** Per-usage accessible name of the menu button; defaults to the `shellThemeToggle` family's `toggle`. */
	readonly label?: string;
}

/** Every choice the menu offers, in order: the token themes, then following the system. */
const THEME_CHOICES: readonly ThemeChoice[] = [...THEME_NAMES, "system"];

/** Each choice's icon — Nord is the arctic one. */
const THEME_ICONS: Readonly<Record<ThemeChoice, LucideIcon>> = {
	light: Sun,
	dark: Moon,
	nord: Snowflake,
	system: Monitor,
};

/** A radio value (or a stored theme), as a choice (`undefined` for anything else). */
function toThemeChoice(value: string | undefined): ThemeChoice | undefined {
	return THEME_CHOICES.find((choice) => choice === value);
}

/** The theme on screen as a token theme (`undefined` until the browser has resolved it). */
function toThemeName(value: string | undefined): ThemeName | undefined {
	return THEME_NAMES.find((name) => name === value);
}

/**
 * Theme menu for app shell topbars and sidebars: an icon button showing the theme on screen
 * (sun, moon, or Nord's snowflake) that opens Light / Dark / Nord / System. Hydration-safe:
 * renders a transparent placeholder icon on the server and during hydration, then the real one.
 *
 * The theme itself is owned by the app-wide `next-themes` store (the single theme mechanism —
 * rules/07), not by this control: it reads and writes that store, and a choice animates as a
 * reveal growing from this button (`useThemeToggle`). A caller's `onClick` runs when the menu
 * button is pressed.
 */
export const ShellThemeToggle = React.forwardRef<HTMLElement, ShellThemeToggleProps>(function ShellThemeToggle(
	{ label, className, variant = "ghost", size = "icon", ...props },
	ref,
): React.JSX.Element {
	const labels = useUiKitLabels("shellThemeToggle");
	const { theme, resolvedTheme, chooseTheme } = useThemeToggle();
	// The resolved theme is only known in the browser: render the placeholder icon
	// on the server and during hydration, the real one after (no mount effect).
	const mounted = useIsClient();
	const triggerRef = React.useRef<HTMLElement | null>(null);
	const setTriggerRef = React.useMemo(() => mergeRefs<HTMLElement>(ref, triggerRef), [ref]);

	const handleValueChange = React.useCallback(
		(value: string): void => {
			const choice = toThemeChoice(value);
			if (choice !== undefined) {
				chooseTheme(choice, triggerRef.current);
			}
		},
		[chooseTheme],
	);

	const shown = toThemeName(resolvedTheme);
	const ShownIcon = THEME_ICONS[shown ?? "light"];

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				ref={setTriggerRef}
				render={<Button variant={variant} size={size} className={cn("rounded-full", className)} />}
				data-slot="shell-theme-toggle"
				aria-label={label ?? labels.toggle}
				{...props}>
				{mounted && shown !== undefined ? <ShownIcon className="size-5" /> : <Sun className="size-5 opacity-0" aria-hidden="true" />}
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-36">
				<DropdownMenuRadioGroup value={toThemeChoice(theme) ?? "system"} onValueChange={handleValueChange}>
					{THEME_CHOICES.map((choice) => {
						const Icon = THEME_ICONS[choice];
						return (
							<DropdownMenuRadioItem key={choice} value={choice} highlight="soft">
								<Icon aria-hidden="true" />
								{labels[choice]}
							</DropdownMenuRadioItem>
						);
					})}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
});
