// An app's navigation panel (the web kit's `Sidebar`): a header (a workspace
// switcher, a brand), groups of items with glyphs and counts, items that open
// sub-menus in place, a search that narrows the items (opening every
// sub-menu that still matches, and keeping pinned items), a loading spinner,
// an empty message, and a footer (an account, a plan's usage). Collapsed, it
// is an icon rail: glyphs only, each still named for screen readers.
//
// On a phone it lives in a drawer (Sheet from the left) or fills a screen;
// this component is the panel's content, not the drawer. Data-agnostic:
// `groups` in; each item's `onPress` is the caller's navigation. The search
// text and the open sub-menus are the panel's own display state. The ref
// reaches the root view.

import { cva } from "class-variance-authority";
import ChevronDownIcon from "lucide-react-native/icons/chevron-down";
import ChevronRightIcon from "lucide-react-native/icons/chevron-right";
import SearchIcon from "lucide-react-native/icons/search";
import XIcon from "lucide-react-native/icons/x";
import * as React from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { Icon, type LucideIcon } from "./icon";

export interface SidebarItem {
	readonly key: string;
	readonly label: string;
	readonly icon?: LucideIcon | undefined;
	/** A count after the label ("12"). */
	readonly badge?: string | undefined;
	/** The current page. */
	readonly active?: boolean | undefined;
	readonly onPress?: (() => void) | undefined;
	/** A sub-menu, opening in place. */
	readonly items?: readonly SidebarItem[] | undefined;
	/** Always shown, whatever the search. */
	readonly pinned?: boolean | undefined;
}

export interface SidebarGroup {
	readonly key: string;
	readonly label?: string | undefined;
	readonly items: readonly SidebarItem[];
}

export const sidebarVariants = cva("gap-2", {
	variants: {
		/** `panel`: flush, with a border at its end. `inset`: a rounded card. `plain`: no surface. */
		variant: { panel: "border-r border-sidebar-border bg-sidebar", inset: "rounded-card border border-sidebar-border bg-sidebar", plain: "" },
		collapsed: { true: "w-16 items-center", false: "" },
	},
	defaultVariants: { variant: "panel", collapsed: false },
});

export const sidebarItemVariants = cva("min-h-11 flex-row items-center gap-3 rounded-lg px-3", {
	variants: {
		active: { true: "bg-sidebar-active", false: "active:bg-sidebar-accent" },
		collapsed: { true: "w-11 justify-center px-0", false: "" },
	},
	defaultVariants: { active: false, collapsed: false },
});

const sidebarItemLabelVariants = cva("text-body flex-1", {
	variants: {
		active: { true: "font-sans-semibold text-sidebar-active-foreground", false: "font-sans text-sidebar-foreground" },
	},
	defaultVariants: { active: false },
});

/** A sub-menu's indent under its parent's label. */
const SUB_MENU_INDENT = "ml-6 border-l border-sidebar-border pl-2";
/** The clear button's extra touch area around its 24 pt circle, to reach 44 pt (rules/04). */
const CLEAR_HIT_SLOP = 10;

function matches(item: SidebarItem, needle: string): boolean {
	return item.label.toLowerCase().includes(needle) || (item.items ?? []).some((child: SidebarItem): boolean => matches(child, needle));
}

/** The items a search keeps: matching ones (with their matching sub-items) and pinned ones. */
export function filterSidebarItems(items: readonly SidebarItem[], query: string): readonly SidebarItem[] {
	const needle = query.trim().toLowerCase();
	if (needle === "") {
		return items;
	}
	return items
		.filter((item: SidebarItem): boolean => item.pinned === true || matches(item, needle))
		.map((item: SidebarItem): SidebarItem =>
			item.items === undefined || item.label.toLowerCase().includes(needle) ? item : { ...item, items: filterSidebarItems(item.items, query) },
		);
}

export interface SidebarProps {
	readonly groups: readonly SidebarGroup[];
	readonly header?: React.ReactNode | undefined;
	readonly footer?: React.ReactNode | undefined;
	/** An icon rail: glyphs only. */
	readonly collapsed?: boolean | undefined;
	/** A search over the items: its placeholder. */
	readonly searchPlaceholder?: string | undefined;
	/** The items are loading: a spinner at the top. */
	readonly loading?: boolean | undefined;
	/** Shown when a search keeps nothing. */
	readonly emptyMessage?: string | undefined;
	readonly variant?: "panel" | "inset" | "plain" | undefined;
	/** The panel's name for screen readers. Default "Navigation". */
	readonly accessibilityLabel?: string | undefined;
	/** Extra classes for the panel, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

interface ItemRowProps {
	readonly item: SidebarItem;
	readonly collapsed: boolean;
	readonly open: boolean;
	readonly onToggle: (key: string) => void;
	readonly openKeys: ReadonlySet<string>;
	readonly forceOpen: boolean;
}

function hasActive(item: SidebarItem): boolean {
	return item.active === true || (item.items ?? []).some(hasActive);
}

const ItemRow = React.memo(function ItemRow({ item, collapsed, open, onToggle, openKeys, forceOpen }: ItemRowProps): React.JSX.Element {
	const branch = item.items !== undefined && !collapsed;
	const isOpen = branch && (open || forceOpen);
	const press = React.useCallback((): void => {
		if (branch) {
			onToggle(item.key);
			return;
		}
		item.onPress?.();
	}, [branch, item, onToggle]);
	const active = item.active === true;
	const accessibilityState = React.useMemo(() => ({ selected: active, expanded: branch ? isOpen : undefined }), [active, branch, isOpen]);
	return (
		<View>
			<Pressable
				accessibilityRole={branch ? "button" : "link"}
				accessibilityLabel={item.badge === undefined ? item.label : `${item.label}, ${item.badge}`}
				accessibilityState={accessibilityState}
				onPress={press}
				className={sidebarItemVariants({ active, collapsed })}>
				{item.icon === undefined ? null : <Icon icon={item.icon} size="sm" colorClassName={active ? "accent-sidebar-active-foreground" : "accent-sidebar-foreground"} />}
				{collapsed ? null : (
					<>
						<Text numberOfLines={1} className={sidebarItemLabelVariants({ active })}>
							{item.label}
						</Text>
						{item.badge === undefined ? null : (
							<View className="min-w-5 items-center rounded-full bg-sidebar-accent px-1.5">
								<Text className="text-overline font-sans-semibold text-sidebar-foreground tabular-nums">{item.badge}</Text>
							</View>
						)}
						{branch ? <Icon icon={isOpen ? ChevronDownIcon : ChevronRightIcon} size="sm" colorClassName="accent-sidebar-foreground" /> : null}
					</>
				)}
			</Pressable>
			{isOpen ? (
				<View className={SUB_MENU_INDENT}>
					{(item.items ?? []).map((child: SidebarItem): React.JSX.Element => (
						<ItemRow key={child.key} item={child} collapsed={false} open={openKeys.has(child.key)} onToggle={onToggle} openKeys={openKeys} forceOpen={forceOpen} />
					))}
				</View>
			) : null}
		</View>
	);
});

export const Sidebar = React.memo(
	React.forwardRef<ViewInstance, SidebarProps>(function Sidebar(
		{
			groups,
			header,
			footer,
			collapsed = false,
			searchPlaceholder,
			loading = false,
			emptyMessage = "Nothing matches.",
			variant = "panel",
			accessibilityLabel = "Navigation",
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const [query, setQuery] = React.useState("");
		// Sub-menus holding the current page start open.
		const [openKeys, setOpenKeys] = React.useState<ReadonlySet<string>>(
			() =>
				new Set(
					groups
						.flatMap((group: SidebarGroup) => group.items)
						.filter((item: SidebarItem): boolean => item.items !== undefined && hasActive(item))
						.map((item: SidebarItem): string => item.key),
				),
		);
		const toggle = React.useCallback((key: string): void => {
			setOpenKeys((current: ReadonlySet<string>): ReadonlySet<string> => {
				const next = new Set(current);
				if (next.has(key)) {
					next.delete(key);
				} else {
					next.add(key);
				}
				return next;
			});
		}, []);
		const clear = React.useCallback((): void => {
			setQuery("");
		}, []);
		const searching = query.trim().length > 0;
		const shown = groups
			.map((group: SidebarGroup): SidebarGroup => ({ ...group, items: filterSidebarItems(group.items, query) }))
			.filter((group: SidebarGroup): boolean => group.items.length > 0);
		return (
			<View ref={ref} accessibilityLabel={accessibilityLabel} testID={testID} className={cn(sidebarVariants({ variant, collapsed }), "p-2", className)}>
				{header ?? null}
				{searchPlaceholder !== undefined && !collapsed ? (
					<View className="rounded-button min-h-10 flex-row items-center gap-2 border border-sidebar-border bg-background px-3">
						<Icon icon={SearchIcon} size="sm" colorClassName="accent-muted-foreground" />
						<TextInput
							accessibilityLabel={searchPlaceholder}
							value={query}
							onChangeText={setQuery}
							placeholder={searchPlaceholder}
							placeholderTextColorClassName="accent-muted-foreground"
							autoCapitalize="none"
							autoCorrect={false}
							className="text-body flex-1 py-2 font-sans text-foreground"
						/>
						{searching ? (
							<Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={clear} hitSlop={CLEAR_HIT_SLOP} className="size-6 items-center justify-center">
								<Icon icon={XIcon} size="xs" colorClassName="accent-icon" />
							</Pressable>
						) : null}
					</View>
				) : null}
				{loading ? <ActivityIndicator accessibilityLabel="Loading" colorClassName="accent-muted-foreground" /> : null}
				<ScrollView className="flex-1" contentContainerClassName="gap-3">
					{shown.length === 0 ? <Text className="text-body px-3 py-2 font-sans text-muted-foreground">{emptyMessage}</Text> : null}
					{shown.map((group: SidebarGroup): React.JSX.Element => (
						<View key={group.key} className="gap-0.5">
							{group.label === undefined || collapsed ? null : (
								<Text accessibilityRole="header" className="text-overline font-sans-semibold px-3 pb-1 text-muted-foreground uppercase">
									{group.label}
								</Text>
							)}
							{group.items.map((item: SidebarItem): React.JSX.Element => (
								<ItemRow key={item.key} item={item} collapsed={collapsed} open={openKeys.has(item.key)} onToggle={toggle} openKeys={openKeys} forceOpen={searching} />
							))}
						</View>
					))}
				</ScrollView>
				{footer ?? null}
			</View>
		);
	}),
);
