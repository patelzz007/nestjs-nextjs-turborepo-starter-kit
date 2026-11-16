// A row of content (the web kit's `Item`): leading media (a glyph tile, an
// avatar, a thumbnail), a title and a description, and trailing actions
// (buttons, a badge, a menu) — plus optional full-width header and footer
// rows. The same parts as the web: Item, ItemMedia, ItemContent, ItemTitle,
// ItemDescription, ItemActions, ItemHeader, ItemFooter, and ItemGroup /
// ItemSeparator to stack them.
//
// `variant` is the surface (`default` none, `outline` bordered, `muted`
// filled); `size` the padding (`md`, `sm`, `xs`) — the parts read it from the
// item, as the web's do through `data-size`. With `onPress` the whole row is a
// link (or a button) of its own and must be named. For a settings list of
// tappable rows on one surface, ListGroup with ListRows is the phone's shape.
// Presentational; the refs reach each part's root view.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Pressable, Text, type TextInstance, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { Separator } from "./separator";

export const itemVariants = cva("w-full flex-row flex-wrap items-center rounded-lg border", {
	variants: {
		/** `default` (no surface), `outline` (bordered) or `muted` (filled). */
		variant: { default: "border-transparent", outline: "border-border", muted: "border-transparent bg-muted/50" },
		/** Padding and gaps. */
		size: { md: "gap-3.5 px-4 py-3.5", sm: "gap-2.5 px-3 py-2.5", xs: "gap-2 px-2.5 py-2" },
		pressable: { true: "min-h-11 active:bg-muted", false: "" },
	},
	defaultVariants: { variant: "default", size: "md", pressable: false },
});

export const itemMediaVariants = cva("shrink-0 items-center justify-center", {
	variants: {
		/** `default` (unframed), `icon` (a small bordered tile) or `image` (a cropped thumbnail). */
		variant: { default: "", icon: "size-8 rounded-md border border-border bg-muted", image: "overflow-hidden rounded-sm" },
		size: { md: "", sm: "", xs: "" },
	},
	compoundVariants: [
		{ variant: "image", size: "md", className: "size-10" },
		{ variant: "image", size: "sm", className: "size-8" },
		{ variant: "image", size: "xs", className: "size-6" },
	],
	defaultVariants: { variant: "default", size: "md" },
});

export const itemContentVariants = cva("flex-1", {
	variants: { size: { md: "gap-1", sm: "gap-1", xs: "gap-0" } },
	defaultVariants: { size: "md" },
});

export const itemTitleVariants = cva("text-label font-sans-medium text-foreground");

export const itemDescriptionVariants = cva("font-sans text-muted-foreground", {
	variants: { size: { md: "text-label", sm: "text-label", xs: "text-caption" } },
	defaultVariants: { size: "md" },
});

export const itemActionsVariants = cva("flex-row items-center gap-2");

/** A full-width row above or below the item's main row. */
export const itemEdgeRowVariants = cva("basis-full flex-row items-center justify-between gap-2");

export const itemGroupVariants = cva("w-full", {
	variants: { size: { md: "gap-4", sm: "gap-2.5", xs: "gap-2" } },
	defaultVariants: { size: "md" },
});

export const itemSeparatorVariants = cva("my-2");

type ItemVariantProps = VariantProps<typeof itemVariants>;
export type ItemVariant = NonNullable<ItemVariantProps["variant"]>;
export type ItemSize = NonNullable<ItemVariantProps["size"]>;
export type ItemMediaVariant = NonNullable<VariantProps<typeof itemMediaVariants>["variant"]>;

/** The item's size, for its parts. */
const ItemSizeContext = React.createContext<ItemSize>("md");

interface ItemPartProps {
	readonly children?: React.ReactNode;
	/** Extra classes, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** Decorative, or a control of its own that must be named. */
export type ItemInteraction =
	| { readonly onPress?: undefined; readonly accessibilityLabel?: undefined; readonly accessibilityRole?: undefined }
	| {
			/** The whole row opens something. */
			readonly onPress: () => void;
			/** The row's name, as a control. */
			readonly accessibilityLabel: string;
			/** Default `link`. */
			readonly accessibilityRole?: "link" | "button" | undefined;
	  };

export type ItemProps = ItemPartProps &
	ItemInteraction & {
		readonly variant?: ItemVariant | undefined;
		readonly size?: ItemSize | undefined;
	};

export const Item = React.memo(
	React.forwardRef<ViewInstance, ItemProps>(function Item(
		{ children, variant = "default", size = "md", onPress, accessibilityLabel, accessibilityRole = "link", className, testID },
		ref,
	): React.JSX.Element {
		const body = <ItemSizeContext.Provider value={size}>{children}</ItemSizeContext.Provider>;
		if (onPress !== undefined) {
			return (
				<Pressable
					ref={ref}
					accessibilityRole={accessibilityRole}
					accessibilityLabel={accessibilityLabel}
					onPress={onPress}
					testID={testID}
					className={cn(itemVariants({ variant, size, pressable: true }), className)}>
					{body}
				</Pressable>
			);
		}
		return (
			<View ref={ref} testID={testID} className={cn(itemVariants({ variant, size }), className)}>
				{body}
			</View>
		);
	}),
);

export interface ItemMediaProps extends ItemPartProps {
	readonly variant?: ItemMediaVariant | undefined;
}

/** Leading glyph tile, avatar or thumbnail; decorative — the title names the row. */
export const ItemMedia = React.memo(
	React.forwardRef<ViewInstance, ItemMediaProps>(function ItemMedia({ children, variant = "default", className, testID }, ref): React.JSX.Element {
		const size = React.use(ItemSizeContext);
		return (
			<View
				ref={ref}
				accessibilityElementsHidden
				importantForAccessibility="no-hide-descendants"
				testID={testID}
				className={cn(itemMediaVariants({ variant, size }), className)}>
				{children}
			</View>
		);
	}),
);

/** The title and description column; grows to fill the row. */
export const ItemContent = React.memo(
	React.forwardRef<ViewInstance, ItemPartProps>(function ItemContent({ children, className, testID }, ref): React.JSX.Element {
		const size = React.use(ItemSizeContext);
		return (
			<View ref={ref} testID={testID} className={cn(itemContentVariants({ size }), className)}>
				{children}
			</View>
		);
	}),
);

/** The row's title, on one line. */
export const ItemTitle = React.memo(
	React.forwardRef<TextInstance, ItemPartProps>(function ItemTitle({ children, className, testID }, ref): React.JSX.Element {
		return (
			<Text ref={ref} numberOfLines={1} testID={testID} className={cn(itemTitleVariants(), className)}>
				{children}
			</Text>
		);
	}),
);

/** The row's description, on up to two lines. */
export const ItemDescription = React.memo(
	React.forwardRef<TextInstance, ItemPartProps>(function ItemDescription({ children, className, testID }, ref): React.JSX.Element {
		const size = React.use(ItemSizeContext);
		return (
			<Text ref={ref} numberOfLines={2} testID={testID} className={cn(itemDescriptionVariants({ size }), className)}>
				{children}
			</Text>
		);
	}),
);

/** Trailing controls: buttons, a badge, a menu. */
export const ItemActions = React.memo(
	React.forwardRef<ViewInstance, ItemPartProps>(function ItemActions({ children, className, testID }, ref): React.JSX.Element {
		return (
			<View ref={ref} testID={testID} className={cn(itemActionsVariants(), className)}>
				{children}
			</View>
		);
	}),
);

/** A full-width row above the item's main row. */
export const ItemHeader = React.memo(
	React.forwardRef<ViewInstance, ItemPartProps>(function ItemHeader({ children, className, testID }, ref): React.JSX.Element {
		return (
			<View ref={ref} testID={testID} className={cn(itemEdgeRowVariants(), className)}>
				{children}
			</View>
		);
	}),
);

/** A full-width row below the item's main row. */
export const ItemFooter = React.memo(
	React.forwardRef<ViewInstance, ItemPartProps>(function ItemFooter({ children, className, testID }, ref): React.JSX.Element {
		return (
			<View ref={ref} testID={testID} className={cn(itemEdgeRowVariants(), className)}>
				{children}
			</View>
		);
	}),
);

export interface ItemGroupProps extends ItemPartProps {
	/** The size of the items inside: the gap between them tightens with it. */
	readonly size?: ItemSize | undefined;
}

/** A vertical list of items. */
export const ItemGroup = React.memo(
	React.forwardRef<ViewInstance, ItemGroupProps>(function ItemGroup({ children, size = "md", className, testID }, ref): React.JSX.Element {
		return (
			<View ref={ref} accessibilityRole="list" testID={testID} className={cn(itemGroupVariants({ size }), className)}>
				{children}
			</View>
		);
	}),
);

/** A rule between items of an ItemGroup. */
export const ItemSeparator = React.memo(
	React.forwardRef<ViewInstance, Omit<ItemPartProps, "children">>(function ItemSeparator({ className, testID }, ref): React.JSX.Element {
		return <Separator ref={ref} className={cn(itemSeparatorVariants(), className)} {...(testID === undefined ? {} : { testID })} />;
	}),
);
