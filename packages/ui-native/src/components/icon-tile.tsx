// A small rounded tile holding an icon — the colour cue beside a stat or a
// navigation item, so a column of items scans by meaning instead of reading as
// a wall of grey (rules/07, "Status badges and icon tiles"). The tone follows
// what the item is about, the same on web and mobile: money and active things
// `green`, places `blue`, people and access `violet`, verification and time
// `teal`, waiting `yellow`, ended or blocked `red`, the app's main count
// `brand`. Decorative: the label next to it carries the meaning, so screen
// readers skip it.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { View } from "react-native";

import { cn } from "../lib/cn";
import { Icon, type IconSize, type LucideIcon } from "./icon";

export const iconTileVariants = cva("shrink-0 items-center justify-center", {
	variants: {
		tone: {
			brand: "border border-primary/15 bg-primary/10",
			neutral: "bg-muted",
			green: "bg-tone-green-soft",
			blue: "bg-tone-blue-soft",
			yellow: "bg-tone-yellow-soft",
			red: "bg-tone-red-soft",
			orange: "bg-tone-orange-soft",
			teal: "bg-tone-teal-soft",
			violet: "bg-tone-violet-soft",
		},
		size: {
			sm: "size-8 rounded-md",
			md: "size-10 rounded-lg",
			lg: "size-12 rounded-xl",
		},
	},
	defaultVariants: { tone: "neutral", size: "md" },
});

/** The glyph's colour per tone (Uniwind `accent-*` → the icon's `color`): the tone's text-on-fill pair. */
export const iconTileGlyphVariants = cva("", {
	variants: {
		tone: {
			brand: "accent-primary",
			neutral: "accent-muted-foreground",
			green: "accent-tone-green",
			blue: "accent-tone-blue",
			yellow: "accent-tone-yellow",
			red: "accent-tone-red",
			orange: "accent-tone-orange",
			teal: "accent-tone-teal",
			violet: "accent-tone-violet",
		},
	},
	defaultVariants: { tone: "neutral" },
});

type IconTileVariantProps = VariantProps<typeof iconTileVariants>;
export type IconTileTone = NonNullable<IconTileVariantProps["tone"]>;
export type IconTileSize = NonNullable<IconTileVariantProps["size"]>;

/** The glyph's size step per tile size: 16, 20 and 24 pt, as on the web. */
const GLYPH_SIZE: Readonly<Record<IconTileSize, IconSize>> = {
	sm: "sm",
	md: "md",
	lg: "lg",
};

export interface IconTileProps {
	readonly icon: LucideIcon;
	readonly tone?: IconTileTone;
	readonly size?: IconTileSize;
	/** Extra classes, merged last. */
	readonly className?: string;
	readonly testID?: string;
}

export const IconTile = React.memo(
	React.forwardRef<View, IconTileProps>(function IconTile({ icon, tone = "neutral", size = "md", className, testID }, ref): React.JSX.Element {
		return (
			<View ref={ref} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={testID} className={cn(iconTileVariants({ tone, size }), className)}>
				<Icon icon={icon} size={GLYPH_SIZE[size]} colorClassName={iconTileGlyphVariants({ tone })} />
			</View>
		);
	}),
);
