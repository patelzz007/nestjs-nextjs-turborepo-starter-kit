// An icon from the app's one icon set, Lucide (the web uses lucide-react, so
// both apps share the same glyphs). Presentational and themeable: the caller
// picks the glyph, a size step and a stroke weight, and colours it with a token
// utility through `colorClassName` (`accent-primary`, `accent-muted-foreground`)
// — never a colour value.
//
// Import glyphs one by one (`lucide-react-native/icons/house`), not from the
// package root: Metro does not tree-shake, and the root pulls in every icon.

import type { LucideIcon } from "lucide-react-native";
import * as React from "react";
import { withUniwind } from "uniwind";

export type { LucideIcon };

export type IconSize = "sm" | "md" | "lg" | "xl" | "2xl";

/** Side of each size step, in points — one scale for the whole app. */
export const ICON_SIZES: Readonly<Record<IconSize, number>> = {
	sm: 16,
	md: 20,
	lg: 24,
	xl: 32,
	/** Brand marks (the auth panel's tile). */
	"2xl": 40,
};

export type IconWeight = "regular" | "bold";

/** Stroke width per weight: `bold` marks the selected or emphasised state. */
export const ICON_STROKE_WIDTHS: Readonly<Record<IconWeight, number>> = {
	regular: 1.75,
	bold: 2.25,
};

interface GlyphProps {
	readonly icon: LucideIcon;
	readonly size: number;
	readonly strokeWidth: number;
	/** Filled in by Uniwind from `colorClassName`; unresolved, the glyph keeps its default. */
	readonly color?: string | undefined;
	readonly testID?: string | undefined;
}

function Glyph({ icon: IconGlyph, size, strokeWidth, color, testID }: GlyphProps): React.JSX.Element {
	return <IconGlyph size={size} strokeWidth={strokeWidth} {...(color === undefined ? {} : { color })} {...(testID === undefined ? {} : { testID })} />;
}

/** Maps `colorClassName` (an `accent-*` token utility) onto the glyph's `color`. */
const ThemedGlyph = withUniwind(Glyph);

export interface IconProps {
	readonly icon: LucideIcon;
	readonly size?: IconSize;
	readonly weight?: IconWeight;
	/** An `accent-*` token utility: `accent-primary`, `accent-muted-foreground`, … */
	readonly colorClassName: string;
	readonly testID?: string;
}

/**
 * Icons are decorative by default: the control or text next to them carries the
 * accessible name. A meaningful standalone icon belongs inside an element that
 * has an `accessibilityLabel`.
 */
export function Icon({ icon, size = "lg", weight = "regular", colorClassName, testID }: IconProps): React.JSX.Element {
	return <ThemedGlyph icon={icon} size={ICON_SIZES[size]} strokeWidth={ICON_STROKE_WIDTHS[weight]} colorClassName={colorClassName} testID={testID} />;
}
