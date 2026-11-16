// A menu of actions behind a trigger: the phone form of the web kit's
// DropdownMenu, ContextMenu and Popover. A phone has no room for a floating
// menu beside the trigger, so the choices open in a BottomSheet (an action
// sheet), each a full-width row with an optional glyph. A destructive item is
// drawn in the destructive tone; a disabled one cannot be chosen.
//
// Items are data (`items`), never hardcoded copy. Choosing one closes the menu
// and reports `onSelect(value)`. The open flag is display state the menu may
// keep itself; a caller that needs to own it passes `open` + `onOpenChange`.
//
// The web menu's other rows are kinds of item: a `checkbox` (checked or not,
// the menu stays open so several can be toggled), a `radio` (one of a set,
// checked), with a `description` under the label, a `shortcut` on a hardware
// keyboard, `trailing` text (a time), something `leading` (an avatar), and
// `items` of its own — a submenu, opened in place with a way back. Items that
// share a `group` sit under its heading, a hairline between groups. `header`
// and `footer` hold anything else the sheet needs (an account card, a "Mark
// all as read" button). The trigger is outlined, ghost, primary or
// secondary; `leading` puts an avatar in it.

import { cva, type VariantProps } from "class-variance-authority";
import CheckIcon from "lucide-react-native/icons/check";
import ChevronDownIcon from "lucide-react-native/icons/chevron-down";
import ChevronLeftIcon from "lucide-react-native/icons/chevron-left";
import ChevronRightIcon from "lucide-react-native/icons/chevron-right";
import * as React from "react";
import { ActivityIndicator, Pressable, Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { isInactiveState, resolveControlState } from "../lib/control-state";
import { BottomSheet, type OptionSelectHandler } from "./bottom-sheet";
import { Icon, type LucideIcon } from "./icon";
import { KbdGroup } from "./kbd";

export const dropdownMenuTriggerVariants = cva("flex-row items-center justify-center gap-2", {
	variants: {
		variant: {
			outline: "active:bg-surface-selected border border-border bg-card",
			ghost: "active:bg-surface-selected bg-transparent",
			/** A split button's menu half, or a create menu: the solid action colour. */
			primary: "active:bg-primary-pressed bg-primary",
			secondary: "active:bg-surface-selected bg-secondary",
		},
		/** `icon`: a square trigger that shows only its glyph (a "More" button); its label is still its accessible name. */
		size: {
			md: "min-h-11 rounded-lg px-4 py-3",
			sm: "min-h-9 rounded-full px-3.5 py-1.5",
			icon: "size-11 rounded-lg",
		},
		state: {
			default: "",
			loading: "opacity-60",
			disabled: "opacity-60",
			error: "border border-destructive",
		},
	},
	defaultVariants: { variant: "outline", size: "md", state: "default" },
});

export const dropdownMenuTriggerLabelVariants = cva("font-sans-medium shrink", {
	variants: {
		variant: { outline: "text-foreground", ghost: "text-foreground", primary: "text-primary-foreground", secondary: "text-secondary-foreground" },
		size: { md: "text-body-lg", sm: "text-body", icon: "text-body" },
	},
	defaultVariants: { variant: "outline", size: "md" },
});

/** The trigger's glyphs and spinner per variant (Uniwind `accent-*` → the icon's `color`). */
const TRIGGER_CONTENT_COLOR: Readonly<Record<DropdownMenuTriggerVariant, string>> = {
	outline: "accent-foreground",
	ghost: "accent-foreground",
	primary: "accent-primary-foreground",
	secondary: "accent-secondary-foreground",
};

export const dropdownMenuItemVariants = cva("min-h-12 flex-row items-center gap-3 py-3 active:opacity-70", {
	variants: {
		variant: { default: "", destructive: "" },
		state: { default: "", loading: "opacity-60", disabled: "opacity-60", error: "" },
	},
	defaultVariants: { variant: "default", state: "default" },
});

export const dropdownMenuItemLabelVariants = cva("text-body-lg font-sans", {
	variants: {
		variant: { default: "text-foreground", destructive: "text-destructive-foreground" },
	},
	defaultVariants: { variant: "default" },
});

type DropdownMenuTriggerVariantProps = VariantProps<typeof dropdownMenuTriggerVariants>;
export type DropdownMenuTriggerVariant = NonNullable<DropdownMenuTriggerVariantProps["variant"]>;
export type DropdownMenuSize = NonNullable<DropdownMenuTriggerVariantProps["size"]>;
export type DropdownMenuItemVariant = NonNullable<VariantProps<typeof dropdownMenuItemVariants>["variant"]>;

/** What a row is: an action (the default), a checkbox toggled in place, or one radio of a set. */
export type DropdownMenuItemKind = "action" | "checkbox" | "radio";

/** An item's glyph colour per variant (Uniwind `accent-*` → the icon's `color`). */
const ITEM_ICON_COLOR: Readonly<Record<DropdownMenuItemVariant, string>> = {
	default: "accent-foreground",
	destructive: "accent-destructive-foreground",
};

/** A compact trigger is 36 pt tall: 4 pt more each side reaches the 44 pt minimum (rules/04). */
const SMALL_HIT_SLOP = 4;

/** One choice in the menu. */
export interface DropdownMenuItemData<TValue extends string> {
	readonly value: TValue;
	readonly label: string;
	/** A glyph before the label; decorative — the label names the action. */
	readonly icon?: LucideIcon | undefined;
	readonly variant?: DropdownMenuItemVariant | undefined;
	readonly disabled?: boolean | undefined;
	/** `checkbox`: toggled in place, the menu stays open. `radio`: one of a set. Default `action`. */
	readonly kind?: DropdownMenuItemKind | undefined;
	/** Whether a checkbox or radio row is on. */
	readonly checked?: boolean | undefined;
	/** A line under the label (a plan, an email, what the action does). */
	readonly description?: string | undefined;
	/** The row's shortcut on a hardware keyboard ("⌘", "N"). */
	readonly shortcut?: readonly string[] | undefined;
	/** Short text at the row's end (a time, a count). */
	readonly trailing?: string | undefined;
	/** Something before the label in place of a glyph (an avatar, a logo tile); decorative. */
	readonly leading?: React.ReactNode;
	/** The heading of the group the row belongs to; consecutive rows of one group sit under it. */
	readonly group?: string | undefined;
	/** A submenu: choosing the row opens these in place, with a row back. */
	readonly items?: readonly DropdownMenuItemData<TValue>[] | undefined;
}

export interface DropdownMenuProps<TValue extends string> {
	/** The trigger's text and accessible name ("More actions"). */
	readonly label: string;
	readonly items: readonly DropdownMenuItemData<TValue>[];
	/** An item was chosen (an action or a radio has already asked the menu to close; a checkbox leaves it open). */
	readonly onSelect: OptionSelectHandler<TValue>;
	/** The sheet's heading (defaults to `label`). */
	readonly title?: string | undefined;
	/** Owns the open flag: pass with `onOpenChange`. Left out, the menu keeps it itself. */
	readonly open?: boolean | undefined;
	readonly onOpenChange?: ((open: boolean) => void) | undefined;
	/** The trigger's glyph (required to be visible for `size="icon"`). */
	readonly icon?: LucideIcon | undefined;
	/** Something before the trigger's label (an avatar); decorative. */
	readonly leading?: React.ReactNode;
	/** Hides the trigger's chevron (an account chip, a create button that says what it opens). */
	readonly hideChevron?: boolean | undefined;
	/** Above the rows in the sheet (the signed-in account). */
	readonly header?: React.ReactNode;
	/** Below the rows in the sheet (a "Mark all as read" button). */
	readonly footer?: React.ReactNode;
	readonly variant?: DropdownMenuTriggerVariant | undefined;
	readonly size?: DropdownMenuSize | undefined;
	readonly disabled?: boolean | undefined;
	/** The menu's actions are still loading: the trigger spins and cannot open. */
	readonly loading?: boolean | undefined;
	readonly invalid?: boolean | undefined;
	readonly accessibilityHint?: string | undefined;
	/** Extra classes for the trigger, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** `DropdownMenu`'s call signature: generic over the item value, which `forwardRef` / `memo` alone would erase. */
export type DropdownMenuComponent = <TValue extends string>(props: DropdownMenuProps<TValue> & React.RefAttributes<ViewInstance>) => React.ReactNode;

/** Consecutive rows of one group, with the group's heading (`null` for rows outside any group). */
interface RowGroup {
	readonly key: string;
	readonly heading: string | null;
	readonly items: readonly DropdownMenuItemData<string>[];
}

/** `items` cut into consecutive groups, in order. */
export function groupMenuItems(items: readonly DropdownMenuItemData<string>[]): readonly RowGroup[] {
	const groups: { key: string; heading: string | null; items: DropdownMenuItemData<string>[] }[] = [];
	for (const item of items) {
		const heading = item.group ?? null;
		const last = groups.at(-1);
		if (last?.heading === heading) {
			last.items.push(item);
		} else {
			groups.push({ key: `${String(groups.length)}-${heading ?? ""}`, heading, items: [item] });
		}
	}
	return groups;
}

export const DropdownMenu: DropdownMenuComponent = React.memo(
	React.forwardRef<ViewInstance, DropdownMenuProps<string>>(function DropdownMenu(
		{
			label,
			items,
			onSelect,
			title,
			open,
			onOpenChange,
			icon,
			leading,
			hideChevron = false,
			header,
			footer,
			variant = "outline",
			size = "md",
			disabled = false,
			loading = false,
			invalid = false,
			accessibilityHint,
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const [ownOpen, setOwnOpen] = React.useState(false);
		const isOpen = open ?? ownOpen;
		const state = resolveControlState({ disabled, loading, invalid });
		const isInactive = isInactiveState(state);
		const accessibilityState = React.useMemo(() => ({ disabled: isInactive, busy: loading, expanded: isOpen }), [isInactive, isOpen, loading]);
		const contentColor = TRIGGER_CONTENT_COLOR[variant];

		const changeOpen = React.useCallback(
			(next: boolean): void => {
				if (open === undefined) {
					setOwnOpen(next);
				}
				onOpenChange?.(next);
			},
			[onOpenChange, open],
		);
		const openMenu = React.useCallback((): void => {
			changeOpen(true);
		}, [changeOpen]);
		const closeMenu = React.useCallback((): void => {
			changeOpen(false);
		}, [changeOpen]);

		const showsLabel = size !== "icon";
		return (
			<>
				<Pressable
					ref={ref}
					accessibilityRole="button"
					accessibilityLabel={label}
					accessibilityHint={accessibilityHint}
					accessibilityState={accessibilityState}
					disabled={isInactive}
					onPress={openMenu}
					hitSlop={size === "sm" ? SMALL_HIT_SLOP : undefined}
					testID={testID}
					className={cn(dropdownMenuTriggerVariants({ variant, size, state }), className)}>
					{loading ? <ActivityIndicator size="small" colorClassName={contentColor} /> : null}
					{icon === undefined || loading ? null : <Icon icon={icon} size="md" colorClassName={contentColor} />}
					{leading}
					{showsLabel ? (
						<Text numberOfLines={1} className={dropdownMenuTriggerLabelVariants({ variant, size })}>
							{label}
						</Text>
					) : null}
					{showsLabel && !hideChevron ? <Icon icon={ChevronDownIcon} size="sm" colorClassName={variant === "primary" ? contentColor : "accent-icon"} /> : null}
				</Pressable>
				<DropdownMenuSheet
					visible={isOpen}
					title={title ?? label}
					items={items}
					onSelect={onSelect}
					onClose={closeMenu}
					header={header}
					footer={footer}
					testID={testID === undefined ? undefined : `${testID}-sheet`}
				/>
			</>
		);
	}),
);

export interface DropdownMenuSheetProps<TValue extends string> {
	readonly visible: boolean;
	/** The sheet's heading (a submenu's label replaces it while open). */
	readonly title: string;
	readonly items: readonly DropdownMenuItemData<TValue>[];
	/** An item was chosen; checkbox items keep the sheet open, every other item asks it to close. */
	readonly onSelect: OptionSelectHandler<TValue>;
	readonly onClose: () => void;
	readonly header?: React.ReactNode;
	readonly footer?: React.ReactNode;
	readonly testID?: string | undefined;
}

/** `DropdownMenuSheet`'s call signature: generic over the item value. */
export type DropdownMenuSheetComponent = <TValue extends string>(props: DropdownMenuSheetProps<TValue>) => React.ReactNode;

/** A menu's items in a bottom sheet, with submenus opening in place: the part `DropdownMenu` and `ContextMenu` share. */
export const DropdownMenuSheet: DropdownMenuSheetComponent = React.memo(function DropdownMenuSheet({
	visible,
	title,
	items,
	onSelect,
	onClose,
	header,
	footer,
	testID,
}: DropdownMenuSheetProps<string>): React.JSX.Element {
	const [submenu, setSubmenu] = React.useState<DropdownMenuItemData<string> | null>(null);
	const close = React.useCallback((): void => {
		setSubmenu(null);
		onClose();
	}, [onClose]);
	const choose = React.useCallback(
		(item: DropdownMenuItemData<string>): void => {
			if (item.items !== undefined) {
				setSubmenu(item);
				return;
			}
			if (item.kind !== "checkbox") {
				close();
			}
			onSelect(item.value);
		},
		[close, onSelect],
	);
	const backToMenu = React.useCallback((): void => {
		setSubmenu(null);
	}, []);
	const rows = submenu?.items ?? items;
	return (
		<BottomSheet visible={visible} title={submenu?.label ?? title} onClose={close} testID={testID}>
			{submenu === null ? header : <DropdownMenuBackRow label={title} onPress={backToMenu} />}
			<View accessibilityRole="menu">
				{groupMenuItems(rows).map((group: RowGroup, index: number): React.JSX.Element => (
					<View key={group.key} className={cn(index === 0 ? undefined : "border-t border-border")}>
						{group.heading === null ? null : (
							<Text accessibilityRole="header" className="text-overline font-sans-semibold pt-3 pb-1 text-muted-foreground uppercase">
								{group.heading}
							</Text>
						)}
						{group.items.map((item: DropdownMenuItemData<string>): React.JSX.Element => (
							<DropdownMenuItemRow key={item.value} item={item} onSelect={choose} />
						))}
					</View>
				))}
			</View>
			{submenu === null ? footer : null}
		</BottomSheet>
	);
});

interface DropdownMenuBackRowProps {
	readonly label: string;
	readonly onPress: () => void;
}

/** The row back out of a submenu, named by the menu it returns to. */
const DropdownMenuBackRow = React.memo(function DropdownMenuBackRow({ label, onPress }: DropdownMenuBackRowProps): React.JSX.Element {
	return (
		<Pressable accessibilityRole="button" accessibilityLabel={`Back to ${label}`} onPress={onPress} className="min-h-11 flex-row items-center gap-2 active:opacity-70">
			<Icon icon={ChevronLeftIcon} size="sm" colorClassName="accent-icon" />
			<Text className="text-body font-sans-medium text-muted-foreground">{label}</Text>
		</Pressable>
	);
});

interface DropdownMenuItemRowProps {
	readonly item: DropdownMenuItemData<string>;
	readonly onSelect: (item: DropdownMenuItemData<string>) => void;
}

/** One row in the sheet (internal: the menu's items are data, not parts). */
const DropdownMenuItemRow = React.memo(function DropdownMenuItemRow({ item, onSelect }: DropdownMenuItemRowProps): React.JSX.Element {
	const { label, icon, variant = "default", disabled = false, kind = "action", checked = false, description, shortcut, trailing, leading } = item;
	const state = resolveControlState({ disabled });
	const isInactive = isInactiveState(state);
	const isToggle = kind !== "action";
	const accessibilityState = React.useMemo(() => (isToggle ? { disabled: isInactive, checked } : { disabled: isInactive }), [checked, isInactive, isToggle]);
	const select = React.useCallback((): void => {
		onSelect(item);
	}, [item, onSelect]);
	return (
		<Pressable
			accessibilityRole={kind === "checkbox" ? "checkbox" : kind === "radio" ? "radio" : "menuitem"}
			accessibilityLabel={description === undefined ? label : `${label}, ${description}`}
			accessibilityState={accessibilityState}
			disabled={isInactive}
			onPress={select}
			className={dropdownMenuItemVariants({ variant, state })}>
			{icon === undefined ? null : <Icon icon={icon} size="md" colorClassName={ITEM_ICON_COLOR[variant]} />}
			{leading}
			<View className="flex-1 gap-0.5">
				<Text className={dropdownMenuItemLabelVariants({ variant })}>{label}</Text>
				{description === undefined ? null : <Text className="text-caption font-sans text-muted-foreground">{description}</Text>}
			</View>
			{trailing === undefined ? null : <Text className="text-caption font-sans text-muted-foreground">{trailing}</Text>}
			{shortcut === undefined ? null : <KbdGroup keys={shortcut} />}
			{isToggle && checked ? <Icon icon={CheckIcon} size="sm" colorClassName="accent-foreground" /> : null}
			{item.items === undefined ? null : <Icon icon={ChevronRightIcon} size="sm" colorClassName="accent-icon" />}
		</Pressable>
	);
});
