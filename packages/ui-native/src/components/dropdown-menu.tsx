// A menu of actions behind a trigger: the phone form of the web kit's
// DropdownMenu, ContextMenu and Popover. A phone has no room for a floating
// menu beside the trigger, so the choices open in a BottomSheet (an action
// sheet), each a full-width row with an optional glyph. A destructive item is
// drawn in the destructive tone; a disabled one cannot be chosen.
//
// Items are data (`items`), never hardcoded copy. Choosing one closes the menu
// and reports `onSelect(value)`. The open flag is display state the menu may
// keep itself; a caller that needs to own it passes `open` + `onOpenChange`.

import { cva, type VariantProps } from "class-variance-authority";
import ChevronDownIcon from "lucide-react-native/icons/chevron-down";
import * as React from "react";
import { ActivityIndicator, Pressable, Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { isInactiveState, resolveControlState } from "../lib/control-state";
import { BottomSheet, type OptionSelectHandler } from "./bottom-sheet";
import { Icon, type LucideIcon } from "./icon";

export const dropdownMenuTriggerVariants = cva("flex-row items-center justify-center gap-2 active:opacity-80", {
	variants: {
		variant: {
			outline: "border border-border bg-card",
			ghost: "bg-transparent",
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

export const dropdownMenuTriggerLabelVariants = cva("font-sans-medium shrink text-foreground", {
	variants: {
		size: { md: "text-base", sm: "text-sm", icon: "text-sm" },
	},
	defaultVariants: { size: "md" },
});

export const dropdownMenuItemVariants = cva("min-h-12 flex-row items-center gap-3 border-b border-border py-3 active:opacity-70", {
	variants: {
		variant: { default: "", destructive: "" },
		state: { default: "", loading: "opacity-60", disabled: "opacity-60", error: "" },
	},
	defaultVariants: { variant: "default", state: "default" },
});

export const dropdownMenuItemLabelVariants = cva("flex-1 font-sans text-base", {
	variants: {
		variant: { default: "text-foreground", destructive: "text-destructive-foreground" },
	},
	defaultVariants: { variant: "default" },
});

type DropdownMenuTriggerVariantProps = VariantProps<typeof dropdownMenuTriggerVariants>;
export type DropdownMenuTriggerVariant = NonNullable<DropdownMenuTriggerVariantProps["variant"]>;
export type DropdownMenuSize = NonNullable<DropdownMenuTriggerVariantProps["size"]>;
export type DropdownMenuItemVariant = NonNullable<VariantProps<typeof dropdownMenuItemVariants>["variant"]>;

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
}

export interface DropdownMenuProps<TValue extends string> {
	/** The trigger's text and accessible name ("More actions"). */
	readonly label: string;
	readonly items: readonly DropdownMenuItemData<TValue>[];
	/** An item was chosen (the menu has already asked to close). */
	readonly onSelect: OptionSelectHandler<TValue>;
	/** The sheet's heading (defaults to `label`). */
	readonly title?: string | undefined;
	/** Owns the open flag: pass with `onOpenChange`. Left out, the menu keeps it itself. */
	readonly open?: boolean | undefined;
	readonly onOpenChange?: ((open: boolean) => void) | undefined;
	/** The trigger's glyph (required to be visible for `size="icon"`). */
	readonly icon?: LucideIcon | undefined;
	readonly variant?: DropdownMenuTriggerVariant;
	readonly size?: DropdownMenuSize;
	readonly disabled?: boolean;
	/** The menu's actions are still loading: the trigger spins and cannot open. */
	readonly loading?: boolean;
	readonly invalid?: boolean;
	readonly accessibilityHint?: string | undefined;
	/** Extra classes for the trigger, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** `DropdownMenu`'s call signature: generic over the item value, which `forwardRef` / `memo` alone would erase. */
export type DropdownMenuComponent = <TValue extends string>(props: DropdownMenuProps<TValue> & React.RefAttributes<ViewInstance>) => React.ReactNode;

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
		const choose = React.useCallback(
			(value: string): void => {
				changeOpen(false);
				onSelect(value);
			},
			[changeOpen, onSelect],
		);

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
					{loading ? <ActivityIndicator size="small" colorClassName="accent-foreground" /> : null}
					{icon === undefined || loading ? null : <Icon icon={icon} size="md" colorClassName="accent-foreground" />}
					{showsLabel ? (
						<Text numberOfLines={1} className={dropdownMenuTriggerLabelVariants({ size })}>
							{label}
						</Text>
					) : null}
					{showsLabel ? <Icon icon={ChevronDownIcon} size="sm" colorClassName="accent-muted-foreground" /> : null}
				</Pressable>
				<BottomSheet visible={isOpen} title={title ?? label} onClose={closeMenu} testID={testID === undefined ? undefined : `${testID}-sheet`}>
					<View accessibilityRole="menu">
						{items.map((item: DropdownMenuItemData<string>): React.JSX.Element => (
							<DropdownMenuItemRow key={item.value} item={item} onSelect={choose} />
						))}
					</View>
				</BottomSheet>
			</>
		);
	}),
);

interface DropdownMenuItemRowProps {
	readonly item: DropdownMenuItemData<string>;
	readonly onSelect: (value: string) => void;
}

/** One action in the sheet (internal: the menu's items are data, not parts). */
const DropdownMenuItemRow = React.memo(function DropdownMenuItemRow({ item, onSelect }: DropdownMenuItemRowProps): React.JSX.Element {
	const { value, label, icon, variant = "default", disabled = false } = item;
	const state = resolveControlState({ disabled });
	const isInactive = isInactiveState(state);
	const accessibilityState = React.useMemo(() => ({ disabled: isInactive }), [isInactive]);
	const select = React.useCallback((): void => {
		onSelect(value);
	}, [onSelect, value]);
	return (
		<Pressable
			accessibilityRole="menuitem"
			accessibilityLabel={label}
			accessibilityState={accessibilityState}
			disabled={isInactive}
			onPress={select}
			className={dropdownMenuItemVariants({ variant, state })}>
			{icon === undefined ? null : <Icon icon={icon} size="md" colorClassName={ITEM_ICON_COLOR[variant]} />}
			<Text className={dropdownMenuItemLabelVariants({ variant })}>{label}</Text>
		</Pressable>
	);
});
