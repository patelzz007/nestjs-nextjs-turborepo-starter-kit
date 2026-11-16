// Where the screen sits in the hierarchy (the web kit's `Breadcrumb`): the
// levels above it as links, then the current page. A long trail scrolls
// sideways, or folds its middle levels into an ellipsis (`maxItems`) that can
// open a menu of the hidden levels (`collapsedMenu`). Separators are a
// chevron, a double chevron, a slash or a short bar; each level may lead with
// a glyph or an avatar, carry a count, or show a second line. `variant`
// draws it plain, on a card, as a pill, or as a row of small buttons.
//
// Data-agnostic: `items` in (the last is the current page); each level's
// `onPress` is the caller's navigation. The ref reaches the root view.

import { cva, type VariantProps } from "class-variance-authority";
import ChevronRightIcon from "lucide-react-native/icons/chevron-right";
import ChevronsRightIcon from "lucide-react-native/icons/chevrons-right";
import EllipsisIcon from "lucide-react-native/icons/ellipsis";
import * as React from "react";
import { Pressable, ScrollView, Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { Button } from "./button";
import { DropdownMenu, type DropdownMenuItemData } from "./dropdown-menu";
import { Icon, type IconSize, type LucideIcon } from "./icon";

export interface BreadcrumbItemData {
	/** Stable identity of the level. */
	readonly key: string;
	readonly label: string;
	/** Goes to the level; the current page (the last item) has none. */
	readonly onPress?: (() => void) | undefined;
	/** A glyph before the label. */
	readonly icon?: LucideIcon | undefined;
	/** Before the label, in place of `icon`: an avatar, a tile. Decorative. */
	readonly leading?: React.ReactNode | undefined;
	/** A second line under the label (an email, a file name). */
	readonly description?: string | undefined;
	/** A count after the label ("3"). */
	readonly badge?: string | undefined;
	/** Shows only the glyph; the label still names the level for screen readers. */
	readonly iconOnly?: boolean | undefined;
}

export type BreadcrumbSeparator = "chevron" | "double-chevron" | "slash" | "bar";

export const breadcrumbVariants = cva("", {
	variants: {
		/** `plain`: the trail alone. `card`: on a padded card. `pill`: a tight rounded frame. `buttons`: each level a small button. */
		variant: { plain: "", card: "rounded-card border border-border bg-card px-3 py-2", pill: "self-start rounded-full border border-border bg-card px-3 py-1", buttons: "" },
	},
	defaultVariants: { variant: "plain" },
});

export const breadcrumbLinkLabelVariants = cva("", {
	variants: {
		current: { true: "font-sans-semibold text-foreground", false: "font-sans text-muted-foreground" },
		/** `md`: body text. `sm`: caption text, a trail on one line with other text (a page header's subtitle line). */
		size: { md: "text-body", sm: "text-caption" },
	},
	defaultVariants: { current: false, size: "md" },
});

type BreadcrumbVariantProps = VariantProps<typeof breadcrumbVariants>;
export type BreadcrumbVariant = NonNullable<BreadcrumbVariantProps["variant"]>;
export type BreadcrumbSize = NonNullable<VariantProps<typeof breadcrumbLinkLabelVariants>["size"]>;

/** A level's glyph at each size: as tall as its label's text. */
const CRUMB_ICON_SIZE: Readonly<Record<BreadcrumbSize, IconSize>> = { md: "sm", sm: "xs" };

export interface BreadcrumbProps {
	readonly items: readonly BreadcrumbItemData[];
	readonly separator?: BreadcrumbSeparator | undefined;
	/** Fold the middle levels into an ellipsis past this many items (the first and the last ones stay). */
	readonly maxItems?: number | undefined;
	/** The ellipsis opens a menu of the hidden levels (else it only stands for them). */
	readonly collapsedMenu?: boolean | undefined;
	readonly variant?: BreadcrumbVariant | undefined;
	/** The levels' text and glyphs: `md` (default) or `sm`, caption-sized. Links keep their 44 pt touch area at both. */
	readonly size?: BreadcrumbSize | undefined;
	/** The trail's name for screen readers. Default "Breadcrumb". */
	readonly accessibilityLabel?: string | undefined;
	/** Extra classes for the root view, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** A level, or the folded middle levels. */
type Crumb = { readonly kind: "item"; readonly item: BreadcrumbItemData } | { readonly kind: "ellipsis"; readonly hidden: readonly BreadcrumbItemData[] };

/** How many crumbs the first level and the ellipsis take in a folded trail. */
const FOLD_HEAD = 2;

/** The trail's crumbs: every level, or (past `maxItems`) the first level, an ellipsis for the middle ones, and as many of the last levels as fit. */
export function breadcrumbCrumbsOf(items: readonly BreadcrumbItemData[], maxItems: number | undefined): readonly Crumb[] {
	if (maxItems === undefined || items.length <= maxItems) {
		return items.map((item: BreadcrumbItemData): Crumb => ({ kind: "item", item }));
	}
	const tail = Math.max(maxItems - FOLD_HEAD, 1);
	const [first] = items;
	const head: Crumb[] = first === undefined ? [] : [{ kind: "item", item: first }];
	return [
		...head,
		{ kind: "ellipsis", hidden: items.slice(1, items.length - tail) },
		...items.slice(items.length - tail).map((item: BreadcrumbItemData): Crumb => ({ kind: "item", item })),
	];
}

function Separator({ separator }: { readonly separator: BreadcrumbSeparator }): React.JSX.Element {
	if (separator === "slash") {
		return (
			<Text importantForAccessibility="no" className="text-body font-sans text-muted-foreground">
				/
			</Text>
		);
	}
	if (separator === "bar") {
		return <View importantForAccessibility="no" className="h-3 w-px bg-border" />;
	}
	return <Icon icon={separator === "double-chevron" ? ChevronsRightIcon : ChevronRightIcon} size="xs" colorClassName="accent-muted-foreground" />;
}

interface CrumbLinkProps {
	readonly item: BreadcrumbItemData;
	readonly current: boolean;
	readonly variant: BreadcrumbVariant;
	readonly size: BreadcrumbSize;
}

const CrumbLink = React.memo(function CrumbLink({ item, current, variant, size }: CrumbLinkProps): React.JSX.Element {
	if (variant === "buttons") {
		const isStatic = current && item.onPress === undefined;
		return (
			<Button
				label={item.label}
				icon={item.icon}
				variant={current ? "secondary" : "ghost"}
				size="sm"
				disabled={isStatic}
				onPress={item.onPress ?? noop}
				accessibilityLabel={current ? `${item.label}, current page` : item.label}
			/>
		);
	}
	const leading =
		item.leading ??
		(item.icon === undefined ? null : <Icon icon={item.icon} size={CRUMB_ICON_SIZE[size]} colorClassName={current ? "accent-foreground" : "accent-muted-foreground"} />);
	const body = (
		<>
			{leading}
			{item.iconOnly === true ? null : (
				<View>
					<Text numberOfLines={1} className={breadcrumbLinkLabelVariants({ current, size })}>
						{item.label}
					</Text>
					{item.description === undefined ? null : (
						<Text numberOfLines={1} className="text-caption font-sans text-muted-foreground">
							{item.description}
						</Text>
					)}
				</View>
			)}
			{item.badge === undefined ? null : (
				<View className="min-w-5 items-center rounded-full bg-muted px-1.5">
					<Text className="text-overline font-sans-semibold text-foreground tabular-nums">{item.badge}</Text>
				</View>
			)}
		</>
	);
	if (current || item.onPress === undefined) {
		return (
			<View accessible accessibilityRole="text" accessibilityLabel={current ? `${item.label}, current page` : item.label} className="flex-row items-center gap-1.5">
				{body}
			</View>
		);
	}
	return (
		<Pressable
			accessibilityRole="link"
			accessibilityLabel={item.label}
			onPress={item.onPress}
			hitSlop={LINK_HIT_SLOP}
			className="flex-row items-center gap-1.5 active:opacity-60">
			{body}
		</Pressable>
	);
});

/** Links are short text: the extra touch area brings them to 44 pt (rules/04). */
const LINK_HIT_SLOP = 12;

function noop(): void {
	// The current page is not a link.
}

interface CollapsedProps {
	readonly hidden: readonly BreadcrumbItemData[];
	readonly menu: boolean;
}

function Collapsed({ hidden, menu }: CollapsedProps): React.JSX.Element {
	const items = React.useMemo(
		(): readonly DropdownMenuItemData<string>[] =>
			hidden.map((item: BreadcrumbItemData): DropdownMenuItemData<string> => ({ value: item.key, label: item.label, icon: item.icon })),
		[hidden],
	);
	const open = React.useCallback(
		(key: string): void => {
			hidden.find((item: BreadcrumbItemData): boolean => item.key === key)?.onPress?.();
		},
		[hidden],
	);
	if (!menu) {
		return (
			<View accessible accessibilityLabel={`${String(hidden.length)} more levels`} className="px-1">
				<Icon icon={EllipsisIcon} size="sm" colorClassName="accent-muted-foreground" />
			</View>
		);
	}
	return <DropdownMenu label="Show hidden levels" title="Levels" icon={EllipsisIcon} size="icon" variant="ghost" items={items} onSelect={open} />;
}

export const Breadcrumb = React.memo(
	React.forwardRef<ViewInstance, BreadcrumbProps>(function Breadcrumb(
		{ items, separator = "chevron", maxItems, collapsedMenu = false, variant = "plain", size = "md", accessibilityLabel = "Breadcrumb", className, testID },
		ref,
	): React.JSX.Element {
		const crumbs = breadcrumbCrumbsOf(items, maxItems);
		const lastKey = items.at(-1)?.key;
		return (
			<View ref={ref} accessibilityRole="toolbar" accessibilityLabel={accessibilityLabel} testID={testID} className={cn(breadcrumbVariants({ variant }), className)}>
				{/* `grow-0`: a scroll view grows by default, and in a column with no set height (a page header) the one-row
				    trail then grew downward, centring its crumbs far below where its parent measured it. */}
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					className="grow-0"
					contentContainerClassName="items-center gap-1.5"
					testID={testID === undefined ? undefined : `${testID}-scroll`}>
					{crumbs.map((crumb: Crumb, index: number): React.JSX.Element => (
						<View key={crumb.kind === "item" ? crumb.item.key : "ellipsis"} className="flex-row items-center gap-1.5">
							{index === 0 ? null : <Separator separator={separator} />}
							{crumb.kind === "item" ? (
								<CrumbLink item={crumb.item} current={crumb.item.key === lastKey} variant={variant} size={size} />
							) : (
								<Collapsed hidden={crumb.hidden} menu={collapsedMenu} />
							)}
						</View>
					))}
				</ScrollView>
			</View>
		);
	}),
);
