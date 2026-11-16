// A row of headline numbers ("Stars 42", "Commits 1,204"), wrapping onto more
// rows on narrow screens. Presentational and data-agnostic — the caller
// formats each value. Each tile is read by screen readers as "label: value".
// The mobile counterpart of the web kit's `StatCard` row. By default (`plain`) the
// figures stand on their surface with no box of their own, so a row of stats in a
// card is never boxes inside a box (ADR 079). A tile can add a hint under its label
// and a glyph in a tinted tile at its end, as the web's StatCard does.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import type { LucideIcon } from "./icon";
import { IconTile, type IconTileTone } from "./icon-tile";

export interface StatTile {
	readonly label: string;
	readonly value: string;
	/** A short note under the label ("+42 this week"). */
	readonly hint?: string | undefined;
	/** A glyph for the metric, in a tinted tile at the tile's end. */
	readonly icon?: LucideIcon | undefined;
	/** The glyph tile's tint, by what the metric is about. Default `neutral`. */
	readonly iconTone?: IconTileTone | undefined;
}

/** What screen readers hear for a tile: "label: value", then the hint. */
export function describeStatTile(item: StatTile): string {
	return item.hint === undefined ? `${item.label}: ${item.value}` : `${item.label}: ${item.value}, ${item.hint}`;
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
	variants: { size: { md: "text-h3 tracking-tight", sm: "text-body-lg" } },
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
	const figure = (
		<View className="gap-0.5">
			<Text className={statTileValueVariants({ size })}>{item.value}</Text>
			<Text className="text-caption font-sans text-muted-foreground">{item.label}</Text>
			{item.hint === undefined ? null : <Text className="text-caption font-sans text-muted-foreground/80">{item.hint}</Text>}
		</View>
	);
	return (
		<View accessible accessibilityLabel={describeStatTile(item)} className={statTileVariants({ variant, size })}>
			{item.icon === undefined ? (
				figure
			) : (
				<View className="flex-row items-start justify-between gap-3">
					{figure}
					<IconTile icon={item.icon} tone={item.iconTone ?? "neutral"} size="sm" />
				</View>
			)}
		</View>
	);
});
