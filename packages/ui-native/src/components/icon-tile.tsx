// A small tile holding an icon (or initials, a count) — the colour cue beside
// a stat or a navigation item, so a column of items scans by meaning instead
// of reading as a wall of grey (rules/07, "Status badges and icon tiles"). The
// tone follows what the item is about, the same on web and mobile: money and
// active things `green`, places `blue`, people and access `violet`,
// verification and time `teal`, waiting `yellow`, ended or blocked `red`, the
// app's main count `brand`.
//
// The web kit's axes: `variant` is the surface — `tint` (the tone's soft fill,
// the default), `outline`, `elevated` (a raised chip), `soft` (a tinted ring
// around an inner card), `solid` (the tone as a full fill) and `frame` (a muted
// ring around an inset card); `size` xs–xl; `radius` `full` for a circle. A
// `badge` sits on the top-end corner (a status dot).
//
// Decorative by default: the label next to it carries the meaning, so screen
// readers skip it. With `onPress` it is a control of its own (a link, by
// default) and must be named (`accessibilityLabel`).

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Pressable, Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { Icon, type IconSize, type LucideIcon } from "./icon";

type Tone = "brand" | "neutral" | "green" | "blue" | "yellow" | "red" | "orange" | "teal" | "violet";
type Variant = "tint" | "outline" | "elevated" | "soft" | "solid" | "frame";
type Size = "xs" | "sm" | "md" | "lg" | "xl";

/** Classes keyed by tone, for one variant's compound. */
type ToneClasses = Readonly<Record<Tone, string>>;

const TONES: readonly Tone[] = ["brand", "neutral", "green", "blue", "yellow", "red", "orange", "teal", "violet"];
const SIZES: readonly Size[] = ["xs", "sm", "md", "lg", "xl"];

/** The tone's soft fill: the `tint` surface. */
const TINT_FILLS: ToneClasses = {
	brand: "border border-primary/15 bg-primary/10",
	neutral: "bg-muted",
	green: "bg-tone-green-soft",
	blue: "bg-tone-blue-soft",
	yellow: "bg-tone-yellow-soft",
	red: "bg-tone-red-soft",
	orange: "bg-tone-orange-soft",
	teal: "bg-tone-teal-soft",
	violet: "bg-tone-violet-soft",
};

/** The tone as a full fill: the `solid` surface. */
const SOLID_FILLS: ToneClasses = {
	brand: "bg-primary",
	neutral: "bg-muted-foreground",
	green: "bg-tone-green",
	blue: "bg-tone-blue",
	yellow: "bg-tone-yellow",
	red: "bg-tone-red",
	orange: "bg-tone-orange",
	teal: "bg-tone-teal",
	violet: "bg-tone-violet",
};

/** The tone's faint ring: the `soft` surface's outer fill. */
const SOFT_FILLS: ToneClasses = {
	brand: "bg-primary/10",
	neutral: "bg-muted-foreground/10",
	green: "bg-tone-green/10",
	blue: "bg-tone-blue/10",
	yellow: "bg-tone-yellow/10",
	red: "bg-tone-red/10",
	orange: "bg-tone-orange/10",
	teal: "bg-tone-teal/10",
	violet: "bg-tone-violet/10",
};

/** The `soft` surface's inner card: a fainter fill and a tone border. */
const SOFT_INNER: ToneClasses = {
	brand: "border-primary/20 bg-primary/5",
	neutral: "border-muted-foreground/20 bg-muted-foreground/5",
	green: "border-tone-green/20 bg-tone-green/5",
	blue: "border-tone-blue/20 bg-tone-blue/5",
	yellow: "border-tone-yellow/20 bg-tone-yellow/5",
	red: "border-tone-red/20 bg-tone-red/5",
	orange: "border-tone-orange/20 bg-tone-orange/5",
	teal: "border-tone-teal/20 bg-tone-teal/5",
	violet: "border-tone-violet/20 bg-tone-violet/5",
};

/** The glyph's colour on every surface but `solid`: the tone's text-on-fill colour. */
const GLYPH_COLORS: ToneClasses = {
	brand: "accent-primary",
	neutral: "accent-muted-foreground",
	green: "accent-tone-green",
	blue: "accent-tone-blue",
	yellow: "accent-tone-yellow",
	red: "accent-tone-red",
	orange: "accent-tone-orange",
	teal: "accent-tone-teal",
	violet: "accent-tone-violet",
};

/** The glyph's colour on a `solid` fill. */
const SOLID_GLYPH_COLORS: ToneClasses = {
	brand: "accent-primary-foreground",
	neutral: "accent-background",
	green: "accent-tone-green-soft",
	blue: "accent-tone-blue-soft",
	yellow: "accent-tone-yellow-soft",
	red: "accent-tone-red-soft",
	orange: "accent-tone-orange-soft",
	teal: "accent-tone-teal-soft",
	violet: "accent-tone-violet-soft",
};

/** Text content's colour, matching the glyph's. */
const TEXT_COLORS: ToneClasses = {
	brand: "text-primary",
	neutral: "text-muted-foreground",
	green: "text-tone-green",
	blue: "text-tone-blue",
	yellow: "text-tone-yellow",
	red: "text-tone-red",
	orange: "text-tone-orange",
	teal: "text-tone-teal",
	violet: "text-tone-violet",
};

const SOLID_TEXT_COLORS: ToneClasses = {
	brand: "text-primary-foreground",
	neutral: "text-background",
	green: "text-tone-green-soft",
	blue: "text-tone-blue-soft",
	yellow: "text-tone-yellow-soft",
	red: "text-tone-red-soft",
	orange: "text-tone-orange-soft",
	teal: "text-tone-teal-soft",
	violet: "text-tone-violet-soft",
};

/** Each size's corner radius (unless `radius="full"`), and the inner card's, a step smaller. */
const OUTER_RADII: Readonly<Record<Size, string>> = { xs: "rounded-sm", sm: "rounded-md", md: "rounded-lg", lg: "rounded-xl", xl: "rounded-2xl" };
const INNER_RADII: Readonly<Record<Size, string>> = { xs: "rounded-xs", sm: "rounded-sm", md: "rounded-md", lg: "rounded-lg", xl: "rounded-xl" };

interface ToneCompound<TVariant extends Variant> {
	readonly variant: TVariant;
	readonly tone: Tone;
	readonly className: string;
}

interface SizeCompound {
	readonly radius: "default";
	readonly size: Size;
	readonly className: string;
}

/** One compound per tone: `variant` with that tone gets the tone's classes. */
function perTone<TVariant extends Variant>(variant: TVariant, classes: ToneClasses): ToneCompound<TVariant>[] {
	return TONES.map((tone: Tone): ToneCompound<TVariant> => ({ variant, tone, className: classes[tone] }));
}

/** One compound per size, for the default radius: the size's own corner. */
function perSize(radii: Readonly<Record<Size, string>>): SizeCompound[] {
	return SIZES.map((size: Size): SizeCompound => ({ radius: "default", size, className: radii[size] }));
}

export const iconTileVariants = cva("relative shrink-0 items-center justify-center", {
	variants: {
		/** The surface; the tone colours it (`tint`, `soft`, `solid`) or only the glyph. */
		variant: {
			tint: "",
			outline: "border border-border bg-background",
			elevated: "border-2 border-background bg-muted shadow-sm",
			soft: "",
			solid: "",
			frame: "border border-border bg-muted/50",
		},
		tone: { brand: "", neutral: "", green: "", blue: "", yellow: "", red: "", orange: "", teal: "", violet: "" },
		size: { xs: "size-6", sm: "size-8", md: "size-10", lg: "size-12", xl: "size-14" },
		/** `default`: the size's radius. `full`: a circle. */
		radius: { default: "", full: "rounded-full" },
	},
	compoundVariants: [...perTone("tint", TINT_FILLS), ...perTone("solid", SOLID_FILLS), ...perTone("soft", SOFT_FILLS), ...perSize(OUTER_RADII)],
	defaultVariants: { variant: "tint", tone: "neutral", size: "md", radius: "default" },
});

/** The inner card of the `soft` and `frame` surfaces, inset from the ring. */
export const iconTileInnerVariants = cva("absolute border", {
	variants: {
		variant: { soft: "", frame: "border-border bg-card shadow-xs" },
		tone: { brand: "", neutral: "", green: "", blue: "", yellow: "", red: "", orange: "", teal: "", violet: "" },
		size: { xs: "inset-0.5", sm: "inset-0.5", md: "inset-0.5", lg: "inset-1", xl: "inset-1" },
		radius: { default: "", full: "rounded-full" },
	},
	compoundVariants: [...perTone("soft", SOFT_INNER), ...perSize(INNER_RADII)],
	defaultVariants: { variant: "frame", tone: "neutral", size: "md", radius: "default" },
});

/** The glyph's colour per tone (Uniwind `accent-*` → the icon's `color`): the tone's text-on-fill pair. */
export const iconTileGlyphVariants = cva("", {
	variants: {
		tone: GLYPH_COLORS,
		variant: { tint: "", outline: "", elevated: "", soft: "", solid: "", frame: "" },
	},
	compoundVariants: perTone("solid", SOLID_GLYPH_COLORS),
	defaultVariants: { tone: "neutral", variant: "tint" },
});

/** Text content (initials, a count): the glyph's colour, sized to the tile. */
export const iconTileTextVariants = cva("font-sans-semibold tabular-nums", {
	variants: {
		tone: TEXT_COLORS,
		variant: { tint: "", outline: "", elevated: "", soft: "", solid: "", frame: "" },
		size: { xs: "text-overline", sm: "text-caption", md: "text-label", lg: "text-body", xl: "text-body-lg" },
	},
	compoundVariants: perTone("solid", SOLID_TEXT_COLORS),
	defaultVariants: { tone: "neutral", variant: "tint", size: "md" },
});

type IconTileVariantProps = VariantProps<typeof iconTileVariants>;
export type IconTileTone = NonNullable<IconTileVariantProps["tone"]>;
export type IconTileVariant = NonNullable<IconTileVariantProps["variant"]>;
export type IconTileSize = NonNullable<IconTileVariantProps["size"]>;
export type IconTileRadius = NonNullable<IconTileVariantProps["radius"]>;

/** The glyph's size step per tile size: 14, 18, 20, 24 and 32 pt. */
const GLYPH_SIZE: Readonly<Record<IconTileSize, IconSize>> = { xs: "control", sm: "sm", md: "md", lg: "lg", xl: "xl" };

/** What the tile holds: a glyph, or a few characters (initials, a count). */
export type IconTileContent = { readonly icon: LucideIcon; readonly text?: undefined } | { readonly text: string; readonly icon?: undefined };

/** Decorative, or a control of its own that must be named. */
export type IconTileInteraction =
	| { readonly onPress?: undefined; readonly accessibilityLabel?: undefined; readonly accessibilityRole?: undefined }
	| {
			readonly onPress: () => void;
			/** The tile's name, as a control. */
			readonly accessibilityLabel: string;
			/** Default `link`. */
			readonly accessibilityRole?: "link" | "button" | undefined;
	  };

export type IconTileProps = IconTileContent &
	IconTileInteraction & {
		readonly tone?: IconTileTone | undefined;
		readonly variant?: IconTileVariant | undefined;
		readonly size?: IconTileSize | undefined;
		readonly radius?: IconTileRadius | undefined;
		/** On the top-end corner: a status dot. Decorative. */
		readonly badge?: React.ReactNode | undefined;
		/** Extra classes, merged last. */
		readonly className?: string | undefined;
		readonly testID?: string | undefined;
	};

export const IconTile = React.memo(
	React.forwardRef<ViewInstance, IconTileProps>(function IconTile(
		{ icon, text, tone = "neutral", variant = "tint", size = "md", radius = "default", badge, onPress, accessibilityLabel, accessibilityRole = "link", className, testID },
		ref,
	): React.JSX.Element {
		const classes = cn(iconTileVariants({ variant, tone, size, radius }), className);
		const body = (
			<>
				{variant === "soft" || variant === "frame" ? <View className={iconTileInnerVariants({ variant, tone, size, radius })} /> : null}
				{icon === undefined ? (
					<Text numberOfLines={1} className={iconTileTextVariants({ tone, variant, size })}>
						{text}
					</Text>
				) : (
					<Icon icon={icon} size={GLYPH_SIZE[size]} colorClassName={iconTileGlyphVariants({ tone, variant })} />
				)}
				{badge === undefined ? null : <View className="absolute -top-1 -right-1">{badge}</View>}
			</>
		);
		if (onPress !== undefined) {
			return (
				<Pressable
					ref={ref}
					accessibilityRole={accessibilityRole}
					accessibilityLabel={accessibilityLabel}
					onPress={onPress}
					testID={testID}
					className={cn(classes, "active:opacity-70")}>
					{body}
				</Pressable>
			);
		}
		return (
			<View ref={ref} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={testID} className={classes}>
				{body}
			</View>
		);
	}),
);
