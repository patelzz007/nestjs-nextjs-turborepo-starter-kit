// A row of headline numbers ("Stars 42", "Commits 1,204"), wrapping onto more
// rows on narrow screens. Presentational and data-agnostic — the caller
// formats each value. Each tile is read by screen readers as "label: value".
// The mobile counterpart of the web kit's `StatCard` row. By default (`plain`) the
// figures stand on their surface with no box of their own, so a row of stats in a
// card is never boxes inside a box (ADR 079).

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";

export interface StatTile {
	readonly label: string;
	readonly value: string;
}

export const statTilesVariants = cva("flex-row flex-wrap", {
	variants: {
		/** `plain`: figures on the surface they sit on. `muted`: soft filled tiles. `outline`: bordered tiles, for a tinted surface. */
		variant: { plain: "gap-x-6 gap-y-4", muted: "gap-2", outline: "gap-2" },
		size: { md: "", sm: "" },
	},
	defaultVariants: { variant: "plain", size: "md" },
});

export const statTileVariants = cva("grow gap-0.5", {
	variants: {
		variant: { plain: "", muted: "rounded-lg bg-muted", outline: "rounded-lg border border-border bg-card" },
		size: { md: "min-w-20", sm: "min-w-16" },
	},
	compoundVariants: [
		{ variant: ["muted", "outline"], size: "md", className: "px-3 py-2" },
		{ variant: ["muted", "outline"], size: "sm", className: "px-2.5 py-1.5" },
	],
	defaultVariants: { variant: "plain", size: "md" },
});

export const statTileValueVariants = cva("font-sans-bold text-foreground tabular-nums", {
	variants: { size: { md: "text-xl tracking-tight", sm: "text-base" } },
	defaultVariants: { size: "md" },
});

type StatTilesVariantProps = VariantProps<typeof statTilesVariants>;
export type StatTilesVariant = NonNullable<StatTilesVariantProps["variant"]>;
export type StatTilesSize = NonNullable<StatTilesVariantProps["size"]>;

export interface StatTilesProps {
	readonly items: readonly StatTile[];
	readonly variant?: StatTilesVariant;
	readonly size?: StatTilesSize;
	/** Extra classes for the container, merged last. */
	readonly className?: string;
	readonly testID?: string;
}

export const StatTiles = React.memo(
	React.forwardRef<ViewInstance, StatTilesProps>(function StatTiles({ items, variant = "plain", size = "md", className, testID }, ref): React.JSX.Element {
		return (
			<View ref={ref} className={cn(statTilesVariants({ variant, size }), className)} testID={testID}>
				{items.map((item: StatTile): React.JSX.Element => (
					<Tile key={item.label} item={item} variant={variant} size={size} />
				))}
			</View>
		);
	}),
);

interface TileProps {
	readonly item: StatTile;
	readonly variant: StatTilesVariant;
	readonly size: StatTilesSize;
}

const Tile = React.memo(function Tile({ item, variant, size }: TileProps): React.JSX.Element {
	return (
		<View accessible accessibilityLabel={`${item.label}: ${item.value}`} className={statTileVariants({ variant, size })}>
			<Text className={statTileValueVariants({ size })}>{item.value}</Text>
			<Text className="font-sans text-xs text-muted-foreground">{item.label}</Text>
		</View>
	);
});
