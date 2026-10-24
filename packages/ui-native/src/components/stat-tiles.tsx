// A row of headline numbers ("Stars 42", "Commits 1,204"), wrapping onto more
// rows on narrow screens. Presentational and data-agnostic — the caller
// formats each value. Each tile is read by screen readers as "label: value".
// The mobile counterpart of the web kit's `StatCard` row.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";

export interface StatTile {
	readonly label: string;
	readonly value: string;
}

export const statTilesVariants = cva("flex-row flex-wrap gap-2", {
	variants: {
		/** `muted`: soft filled tiles. `outline`: bordered tiles, for a tinted surface. */
		variant: { muted: "", outline: "" },
		size: { md: "", sm: "" },
	},
	defaultVariants: { variant: "muted", size: "md" },
});

export const statTileVariants = cva("grow gap-0.5 rounded-lg", {
	variants: {
		variant: { muted: "bg-muted", outline: "border border-border bg-card" },
		size: { md: "min-w-20 px-3 py-2", sm: "min-w-16 px-2.5 py-1.5" },
	},
	defaultVariants: { variant: "muted", size: "md" },
});

export const statTileValueVariants = cva("font-sans-semibold text-foreground", {
	variants: { size: { md: "text-lg", sm: "text-base" } },
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
	React.forwardRef<ViewInstance, StatTilesProps>(function StatTiles({ items, variant = "muted", size = "md", className, testID }, ref): React.JSX.Element {
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
