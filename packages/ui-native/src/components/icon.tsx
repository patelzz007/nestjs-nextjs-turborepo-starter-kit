// An icon from the app's one icon set, Lucide (the web uses lucide-react, so
// both apps share the same glyphs). Presentational and themeable: the caller
// picks the glyph, a size step and a stroke weight, and colours it with a token
// utility through `colorClassName` (`accent-primary`, `accent-muted-foreground`)
// — never a colour value.
//
// Import glyphs one by one (`lucide-react-native/icons/house`), not from the
// package root: Metro does not tree-shake, and the root pulls in every icon.
//
// A Lucide glyph's type carries no ref, so the glyph sits in a `View` box of
// exactly its size: that box is what the forwarded ref reaches (to measure or
// animate the icon) and what `className` lays out.

import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react-native";
import * as React from "react";
import { View } from "react-native";
import { withUniwind } from "uniwind";

import { cn } from "../lib/cn";

export type { LucideIcon };

/** The glyph's box: the same side as `ICON_SIZES` (size-4 = 16 pt, …), so layout matches the drawing. */
export const iconVariants = cva("shrink-0 items-center justify-center", {
	variants: {
		size: {
			sm: "size-4",
			md: "size-5",
			lg: "size-6",
			xl: "size-8",
			"2xl": "size-10",
		},
	},
	defaultVariants: { size: "lg" },
});

export type IconSize = NonNullable<VariantProps<typeof iconVariants>["size"]>;

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
	readonly size?: IconSize | undefined;
	readonly weight?: IconWeight | undefined;
	/** An `accent-*` token utility: `accent-primary`, `accent-muted-foreground`, … */
	readonly colorClassName: string;
	/** Extra classes for the glyph's box, merged last (layout: `mt-0.5`, `absolute`). */
	readonly className?: string | undefined;
	/** Set on the glyph itself (its drawn size and stroke are what tests check). */
	readonly testID?: string | undefined;
}

/**
 * Icons are decorative by default: the control or text next to them carries the
 * accessible name. A meaningful standalone icon belongs inside an element that
 * has an `accessibilityLabel`.
 */
export const Icon = React.memo(
	React.forwardRef<View, IconProps>(function Icon({ icon, size = "lg", weight = "regular", colorClassName, className, testID }, ref): React.JSX.Element {
		return (
			<View ref={ref} className={cn(iconVariants({ size }), className)}>
				<ThemedGlyph icon={icon} size={ICON_SIZES[size]} strokeWidth={ICON_STROKE_WIDTHS[weight]} colorClassName={colorClassName} testID={testID} />
			</View>
		);
	}),
);
