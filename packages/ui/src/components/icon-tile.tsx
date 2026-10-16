// Ported from ReUI (https://reui.io/r/base-vega/icon-tile.json). The `variant`,
// `size` and `radius` axes, the `render` prop, the CSS-variable sizing and the
// `data-slot` / `data-variant` / `data-size` attributes match ReUI, so its docs
// and examples apply, with these deliberate deviations:
// - A `tone` axis (the kit's brand / neutral / categorical tone palette in
//   packages/tokens) colours every variant, where ReUI retints with ad-hoc
//   `text-*` / `bg-*` classes. Every tone's text-on-fill pair meets WCAG AA in
//   both themes (`solid` uses the same pair inverted, so it holds too). A
//   `className` text colour still retints `soft`, as in ReUI.
// - A `tint` variant — the kit's original look: the tone's soft fill with its
//   glyph colour — is the default, so existing tiles keep rendering unchanged.
//   ReUI's default is `outline`; pass it explicitly to match a ReUI example.
// - Sizes keep the kit's `sm` / `md` / `lg` scale and add ReUI's `xs`, `xl`
//   and `default` (an alias of `md`, ReUI's name for the middle rung). Each
//   size carries its own corner radius from the radius scale.
// - Decorative by default (`aria-hidden`): the label next to it carries the
//   meaning. A caller that renders it as something meaningful overrides it.
// - `elevated` uses the kit's `shadow-sm` token instead of an arbitrary shadow.
// - The root forwards its ref.
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "@workspace/ui/lib/core/utils";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { z } from "zod";

/** The tile's colour: the app's brand, a muted neutral, or a categorical tone. */
export const IconTileToneSchema = z.enum(["brand", "neutral", "green", "blue", "yellow", "red", "orange", "teal", "violet"]);
export type IconTileTone = z.output<typeof IconTileToneSchema>;

/** The tile's surface treatment. */
export const IconTileVariantSchema = z.enum(["tint", "outline", "elevated", "soft", "solid", "frame"]);
export type IconTileVariant = z.output<typeof IconTileVariantSchema>;

/** The tile's corner radius, clamped by the size so a small tile keeps its shape. */
const TILE_RADIUS = "rounded-[var(--icon-tile-radius,var(--icon-tile-size-radius))]";
/** The inner card of `soft` / `frame`: the outer radius minus the inset, so the two corners stay concentric. */
const INNER_CARD = [
	"isolate p-(--icon-tile-inset)",
	"after:absolute after:inset-(--icon-tile-inset) after:-z-10",
	"after:rounded-[calc(var(--icon-tile-radius,var(--icon-tile-size-radius))-var(--icon-tile-inset))]",
];

const VARIANT_CLASSES: Readonly<Record<IconTileVariant, string | string[]>> = {
	/** The tone's soft fill with its glyph colour — the kit's quiet, colourful default. */
	tint: "",
	/** Plain bordered surface. The quiet choice for list rows and toolbars. */
	outline: "border border-border bg-background dark:bg-input/32",
	/** Raised muted fill with a background-coloured ring. Reads as a physical chip. */
	elevated: "border-2 border-background bg-muted text-accent-foreground shadow-sm dark:border",
	/** Tinted double container derived from `currentColor`: an opacity-filled ring around a bordered inner card. */
	soft: [...INNER_CARD, "bg-current/10 after:border after:border-current/20 after:bg-current/5"],
	/** The tone as a solid fill with a contrasting glyph. */
	solid: "",
	/** Double container — a muted ring around an inset card, matching Frame. */
	frame: [...INNER_CARD, "border border-border bg-muted/50 after:border after:border-border after:bg-card after:shadow-xs"],
};

/** What each tone paints, per variant family. */
interface IconTileToneClasses {
	/** `tint`: the soft fill and the glyph colour. */
	readonly tint: string;
	/** `solid`: the full-strength fill and the contrasting glyph. */
	readonly solid: string;
	/** `outline` / `elevated` / `soft` / `frame`: the glyph (and, for `soft`, the `currentColor` tint). */
	readonly glyph: string;
}

const TONE_CLASSES: Readonly<Record<IconTileTone, IconTileToneClasses>> = {
	brand: { tint: "bg-primary/10 text-primary ring-1 ring-primary/15 ring-inset", solid: "bg-primary text-primary-foreground", glyph: "text-primary" },
	neutral: { tint: "bg-muted text-muted-foreground", solid: "bg-muted-foreground text-background", glyph: "text-muted-foreground" },
	green: { tint: "bg-tone-green-soft text-tone-green", solid: "bg-tone-green text-tone-green-soft", glyph: "text-tone-green" },
	blue: { tint: "bg-tone-blue-soft text-tone-blue", solid: "bg-tone-blue text-tone-blue-soft", glyph: "text-tone-blue" },
	yellow: { tint: "bg-tone-yellow-soft text-tone-yellow", solid: "bg-tone-yellow text-tone-yellow-soft", glyph: "text-tone-yellow" },
	red: { tint: "bg-tone-red-soft text-tone-red", solid: "bg-tone-red text-tone-red-soft", glyph: "text-tone-red" },
	orange: { tint: "bg-tone-orange-soft text-tone-orange", solid: "bg-tone-orange text-tone-orange-soft", glyph: "text-tone-orange" },
	teal: { tint: "bg-tone-teal-soft text-tone-teal", solid: "bg-tone-teal text-tone-teal-soft", glyph: "text-tone-teal" },
	violet: { tint: "bg-tone-violet-soft text-tone-violet", solid: "bg-tone-violet text-tone-violet-soft", glyph: "text-tone-violet" },
};

/** The tone axis carries no classes of its own: each variant reads its colour from `TONE_CLASSES`. */
const TONE_AXIS: Readonly<Record<IconTileTone, string>> = {
	brand: "",
	neutral: "",
	green: "",
	blue: "",
	yellow: "",
	red: "",
	orange: "",
	teal: "",
	violet: "",
};

/** The variants whose tone only colours the glyph. */
const GLYPH_TONED_VARIANTS: IconTileVariant[] = ["outline", "elevated", "soft", "frame"];

interface IconTileCompoundVariant {
	readonly variant: IconTileVariant | IconTileVariant[];
	readonly tone: IconTileTone;
	readonly className: string;
}

const TONE_COMPOUND_VARIANTS: IconTileCompoundVariant[] = IconTileToneSchema.options.flatMap((tone: IconTileTone): IconTileCompoundVariant[] => {
	const classes = TONE_CLASSES[tone];
	return [
		{ variant: "tint", tone, className: classes.tint },
		{ variant: "solid", tone, className: classes.solid },
		{ variant: GLYPH_TONED_VARIANTS, tone, className: classes.glyph },
	];
});

/** The middle rung, shared by the kit's `md` and ReUI's `default`. */
const MEDIUM_SIZE = "[--icon-tile-icon-size:--spacing(5)] [--icon-tile-inset:--spacing(0.75)] [--icon-tile-size-radius:var(--radius-lg)] [--icon-tile-size:--spacing(10)]";

/**
 * CSS variable architecture (from ReUI): the root owns the variables below so
 * every part of the tile stays in proportion and overridable from one `className`:
 *
 *   --icon-tile-size         tile width / height
 *   --icon-tile-icon-size    glyph size applied to child svgs (an svg with its own `size-*` keeps it)
 *   --icon-tile-size-radius  the size's corner radius
 *   --icon-tile-radius       an explicit radius (the `radius` axis), winning over the size's
 *   --icon-tile-inset        gap between the outer ring and the inner card (`soft` / `frame`)
 *
 * `soft` and `frame` paint their inner card with an `::after` pseudo element;
 * `isolate` makes the root a stacking context, so the negative z-index pseudo
 * paints above the root background but below the in-flow icon.
 */
export const iconTileVariants = cva(
	[
		"relative inline-flex shrink-0 items-center justify-center align-middle",
		"size-(--icon-tile-size)",
		TILE_RADIUS,
		"[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-(--icon-tile-icon-size)",
	],
	{
		variants: {
			variant: VARIANT_CLASSES,
			tone: TONE_AXIS,
			size: {
				xs: "[--icon-tile-icon-size:--spacing(3.5)] [--icon-tile-inset:--spacing(0.5)] [--icon-tile-size-radius:var(--radius-sm)] [--icon-tile-size:--spacing(6)]",
				sm: "[--icon-tile-icon-size:--spacing(4)] [--icon-tile-inset:--spacing(0.5)] [--icon-tile-size-radius:var(--radius-md)] [--icon-tile-size:--spacing(8)]",
				md: MEDIUM_SIZE,
				default: MEDIUM_SIZE,
				lg: "[--icon-tile-icon-size:--spacing(6)] [--icon-tile-inset:--spacing(0.75)] [--icon-tile-size-radius:var(--radius-xl)] [--icon-tile-size:--spacing(12)]",
				xl: "[--icon-tile-icon-size:--spacing(7)] [--icon-tile-inset:--spacing(1)] [--icon-tile-size-radius:var(--radius-2xl)] [--icon-tile-size:--spacing(14)]",
			},
			/** `default`: the size's radius. `full`: circular. */
			radius: {
				default: "",
				full: "[--icon-tile-radius:calc(infinity*1px)]",
			},
		},
		compoundVariants: TONE_COMPOUND_VARIANTS,
		defaultVariants: {
			variant: "tint",
			tone: "neutral",
			size: "md",
			radius: "default",
		},
	},
);

export type IconTileSize = NonNullable<VariantProps<typeof iconTileVariants>["size"]>;
export type IconTileRadius = NonNullable<VariantProps<typeof iconTileVariants>["radius"]>;

export interface IconTileProps extends useRender.ComponentProps<"span">, VariantProps<typeof iconTileVariants> {}

export const IconTile = React.forwardRef<HTMLSpanElement, IconTileProps>(function IconTile(
	{ className, variant = "tint", tone = "neutral", size = "md", radius = "default", render, ...props },
	ref,
): React.ReactElement {
	return useRender({
		ref,
		defaultTagName: "span",
		props: mergeProps<"span">(
			{
				"aria-hidden": true,
				className: cn(iconTileVariants({ variant, tone, size, radius }), className),
			},
			props,
		),
		render,
		state: {
			slot: "icon-tile",
			variant,
			tone,
			size,
		},
	});
});
