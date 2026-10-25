import { Button } from "@workspace/ui/components/button";
import { createElement, type ComponentProps, type ReactElement } from "react";

import { iconSvg, type IconName } from "../icons";

/**
 * The code blocks' theme toggle (src/scripts/code-theme.ts handles the click).
 * It renders all three states; CSS shows the one `data-code-theme` on `<html>`
 * names ("Auto" = match the site), so the server-rendered and hydrated trees
 * never differ, whatever the reader stored. The hidden prefix makes each state
 * read as "Code theme: dark" to assistive tech.
 */

interface CodeThemeState {
	readonly state: "site" | "light" | "dark";
	readonly icon: IconName;
	readonly label: string;
}

const STATES: readonly CodeThemeState[] = [
	{ state: "site", icon: "sunMoon", label: "Auto" },
	{ state: "light", icon: "sun", label: "Light" },
	{ state: "dark", icon: "moon", label: "Dark" },
];

function stateLabel({ state, icon, label }: CodeThemeState): ReactElement {
	return createElement(
		"span",
		{ key: state, className: "code-theme-state", "data-code-theme-state": state },
		createElement("span", { "aria-hidden": "true", className: "inline-flex", dangerouslySetInnerHTML: { __html: iconSvg(icon, 14) } }),
		createElement("span", { className: "sr-only" }, "Code theme: "),
		label,
	);
}

/** The class src/scripts/code-theme.ts listens for (`CODE_THEME_TOGGLE_CLASS`), kept literal: this module also renders at build time. */
const TOGGLE_PROPS: ComponentProps<typeof Button> = {
	type: "button",
	variant: "ghost",
	size: "sm",
	className: "code-theme-toggle shrink-0 gap-1.5",
	title: "Code theme: Auto follows the site, or pick light or dark",
};

export function codeThemeToggleElement(): ReactElement {
	return createElement(Button, TOGGLE_PROPS, STATES.map(stateLabel));
}
