// Label/value pairs ("Signed in: 3 Oct 2026"). Values are rendered as text,
// never as markup (client-reported device details included). Each pair is
// read by screen readers as "label: value".

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";

export interface DetailItem {
	readonly label: string;
	readonly value: string;
}

export const detailListVariants = cva("", {
	variants: {
		/** `inline`: "Label: value" on one wrapping line. `stacked`: the label above its value. */
		variant: { inline: "", stacked: "" },
		size: { md: "gap-1", sm: "gap-0.5" },
	},
	compoundVariants: [{ variant: "stacked", size: "md", className: "gap-3" }],
	defaultVariants: { variant: "inline", size: "md" },
});

export const detailItemVariants = cva("", {
	variants: {
		variant: { inline: "flex-row flex-wrap gap-1", stacked: "gap-0.5" },
	},
	defaultVariants: { variant: "inline" },
});

export const detailLabelVariants = cva("font-sans text-muted-foreground", {
	variants: {
		size: { md: "text-sm", sm: "text-xs" },
	},
	defaultVariants: { size: "md" },
});

export const detailValueVariants = cva("shrink font-sans text-foreground", {
	variants: {
		size: { md: "text-sm", sm: "text-xs" },
	},
	defaultVariants: { size: "md" },
});

type DetailListVariantProps = VariantProps<typeof detailListVariants>;
export type DetailListVariant = NonNullable<DetailListVariantProps["variant"]>;
export type DetailListSize = NonNullable<DetailListVariantProps["size"]>;

export interface DetailListProps {
	readonly items: readonly DetailItem[];
	readonly variant?: DetailListVariant;
	readonly size?: DetailListSize;
	/** Extra classes for the container, merged last (layout: `mt-2`). */
	readonly className?: string;
	readonly testID?: string;
}

export const DetailList = React.memo(
	React.forwardRef<ViewInstance, DetailListProps>(function DetailList({ items, variant = "inline", size = "md", className, testID }, ref): React.JSX.Element {
		return (
			<View ref={ref} className={cn(detailListVariants({ variant, size }), className)} testID={testID}>
				{items.map((item: DetailItem): React.JSX.Element => (
					<DetailRow key={item.label} item={item} variant={variant} size={size} />
				))}
			</View>
		);
	}),
);

interface DetailRowProps {
	readonly item: DetailItem;
	readonly variant: DetailListVariant;
	readonly size: DetailListSize;
}

const DetailRow = React.memo(function DetailRow({ item, variant, size }: DetailRowProps): React.JSX.Element {
	return (
		<View className={detailItemVariants({ variant })} accessible accessibilityLabel={`${item.label}: ${item.value}`}>
			<Text className={detailLabelVariants({ size })}>{variant === "inline" ? `${item.label}:` : item.label}</Text>
			<Text className={detailValueVariants({ size })}>{item.value}</Text>
		</View>
	);
});
