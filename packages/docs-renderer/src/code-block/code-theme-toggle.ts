import { Button } from "@workspace/ui/components/button";
import { Moon, Sun, SunMoon, type LucideIcon } from "lucide-react";
import { createElement, type ComponentProps, type ReactElement } from "react";

/**
 * The code blocks' theme toggle (the docs app's code-theme controller handles the click).
 * It renders all three states; CSS shows the one `data-code-theme` on `<html>`
 * names ("Auto" = match the site), so the server-rendered and hydrated trees
 * never differ, whatever the reader stored. The hidden prefix makes each state
 * read as "Code theme: dark" to assistive tech.
 */

interface CodeThemeState {
	readonly state: "site" | "light" | "dark";
	readonly icon: LucideIcon;
	readonly label: string;
}

const STATES: readonly CodeThemeState[] = [
	{ state: "site", icon: SunMoon, label: "Auto" },
	{ state: "light", icon: Sun, label: "Light" },
	{ state: "dark", icon: Moon, label: "Dark" },
];

/** Glyph size (px) of a state's icon: the toggle sits in the code block's 14px header text. */
const STATE_ICON_SIZE = 14;

function stateLabel({ state, icon, label }: CodeThemeState): ReactElement {
	return createElement(
		"span",
		{ key: state, className: "code-theme-state", "data-code-theme-state": state },
		createElement(icon, { "aria-hidden": "true", size: STATE_ICON_SIZE }),
		createElement("span", { className: "sr-only" }, "Code theme: "),
		label,
	);
}

/** The class the code-theme controller listens for (`CODE_THEME_TOGGLE_CLASS`), kept literal: this module also renders at build time. */
export const CODE_THEME_TOGGLE_CLASS = "code-theme-toggle";

const TOGGLE_PROPS: ComponentProps<typeof Button> = {
	type: "button",
	variant: "ghost",
	size: "sm",
	className: `${CODE_THEME_TOGGLE_CLASS} shrink-0 gap-1.5`,
	title: "Code theme: Auto follows the site, or pick light or dark",
};

export function codeThemeToggleElement(): ReactElement {
	return createElement(Button, TOGGLE_PROPS, STATES.map(stateLabel));
}
