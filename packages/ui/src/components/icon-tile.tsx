import { cn } from "@workspace/ui/lib/core/utils";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

/**
 * A small rounded tile holding an icon — the colour cue for stat cards and
 * navigation lists, so a column of items scans by meaning instead of reading
 * as a wall of grey. `brand` follows the app's primary colour; `neutral` is
 * muted; the named tones are the categorical tone palette (packages/tokens), whose
 * text-on-fill pairs meet WCAG AA in both themes. Decorative: the label next to
 * it carries the meaning, so the tile is hidden from assistive technology.
 */
export const iconTileVariants = cva("inline-flex shrink-0 items-center justify-center [&_svg]:shrink-0", {
	variants: {
		tone: {
			brand: "bg-primary/10 text-primary ring-1 ring-primary/15 ring-inset",
			neutral: "bg-muted text-muted-foreground",
			green: "bg-tone-green-soft text-tone-green",
			blue: "bg-tone-blue-soft text-tone-blue",
			yellow: "bg-tone-yellow-soft text-tone-yellow",
			red: "bg-tone-red-soft text-tone-red",
			orange: "bg-tone-orange-soft text-tone-orange",
			teal: "bg-tone-teal-soft text-tone-teal",
			violet: "bg-tone-violet-soft text-tone-violet",
		},
		size: {
			sm: "size-8 rounded-md [&_svg]:size-4",
			md: "size-10 rounded-lg [&_svg]:size-5",
			lg: "size-12 rounded-xl [&_svg]:size-6",
		},
	},
	defaultVariants: {
		tone: "neutral",
		size: "md",
	},
});

export type IconTileTone = NonNullable<VariantProps<typeof iconTileVariants>["tone"]>;

export interface IconTileProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof iconTileVariants> {}

export const IconTile = React.forwardRef<HTMLSpanElement, IconTileProps>(function IconTile({ tone, size, className, ...props }, ref): React.JSX.Element {
	return <span ref={ref} data-slot="icon-tile" data-tone={tone ?? "neutral"} aria-hidden="true" className={cn(iconTileVariants({ tone, size }), className)} {...props} />;
});
