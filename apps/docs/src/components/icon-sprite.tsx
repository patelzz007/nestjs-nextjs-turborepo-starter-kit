import { createElement, type ReactElement } from "react";

import { iconComponent, type IconName } from "@/lib/icons";

/** The id of an icon's `<symbol>` in the page's sprite. */
export function spriteIconId(name: IconName): string {
	return `docs-icon-${name}`;
}

/** The size (px) the symbols are drawn at; `<use>` scales them to each icon's size. */
const SYMBOL_SIZE = 24;

export interface IconSpriteProps {
	/** The icons the page's repeated lists use (the guide tree). */
	readonly names: readonly IconName[];
}

/**
 * Each icon of the guide tree drawn once per page, as a `<symbol>`; the tree's links point at them with
 * `<use>` (`SpriteIcon`). Every page carries the whole tree, and an inline SVG per link cost ~100 kB a page.
 * Hidden from assistive tech: every icon sits beside the text that names it.
 */
export function IconSprite({ names }: IconSpriteProps): ReactElement {
	return (
		<svg aria-hidden="true" focusable="false" width="0" height="0" className="absolute overflow-hidden">
			{[...new Set(names)].map((name) => (
				<symbol key={name} id={spriteIconId(name)} viewBox={`0 0 ${String(SYMBOL_SIZE)} ${String(SYMBOL_SIZE)}`}>
					{createElement(iconComponent(name), { size: SYMBOL_SIZE })}
				</symbol>
			))}
		</svg>
	);
}

export interface SpriteIconProps {
	readonly name: IconName;
	readonly size: number;
}

/** One icon from the page's sprite (decorative). */
export function SpriteIcon({ name, size }: SpriteIconProps): ReactElement {
	return (
		<svg aria-hidden="true" focusable="false" width={size} height={size}>
			<use href={`#${spriteIconId(name)}`} />
		</svg>
	);
}
