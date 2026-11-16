// The actions for something on screen, opened by a long press on it (the web
// kit's `ContextMenu`, a right click on a desktop): a message, a file, a
// card. The area is the one child; a long press opens its actions in a
// bottom sheet — the same rows as DropdownMenu (icons, shortcuts, checkbox
// and radio items, groups, submenus), shared through DropdownMenuSheet.
// Screen readers get the menu as the area's "long press" action, named in
// its hint, so nobody has to find the gesture.
//
// Data-agnostic: `items` in, `onSelect(value)` out. Open is the menu's own
// display state unless the caller owns it (`open` + `onOpenChange`). The ref
// reaches the area.

import { cva } from "class-variance-authority";
import * as React from "react";
import { type AccessibilityActionEvent, Pressable, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import type { OptionSelectHandler } from "./bottom-sheet";
import { type DropdownMenuItemData, DropdownMenuSheet } from "./dropdown-menu";

export const contextMenuAreaVariants = cva("", {
	variants: {
		/** A pressed area dims, so the long press is felt before the menu opens. */
		state: { default: "active:opacity-80", disabled: "" },
	},
	defaultVariants: { state: "default" },
});

export interface ContextMenuProps<TValue extends string> {
	/** The area a long press opens the menu on. */
	readonly children: React.ReactNode;
	readonly items: readonly DropdownMenuItemData<TValue>[];
	readonly onSelect: OptionSelectHandler<TValue>;
	/** The sheet's heading, and the area's name for screen readers. */
	readonly title: string;
	readonly open?: boolean | undefined;
	readonly onOpenChange?: ((open: boolean) => void) | undefined;
	/** Above the rows: what the menu acts on. */
	readonly header?: React.ReactNode;
	readonly footer?: React.ReactNode;
	readonly disabled?: boolean | undefined;
	/** The area's hint. Default "Long press for actions". */
	readonly accessibilityHint?: string | undefined;
	/** Extra classes for the area, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** `ContextMenu`'s call signature: generic over the item value. */
export type ContextMenuComponent = <TValue extends string>(props: ContextMenuProps<TValue> & React.RefAttributes<ViewInstance>) => React.ReactNode;

const LONG_PRESS_ACTIONS: readonly { readonly name: string; readonly label: string }[] = [{ name: "longpress", label: "Show actions" }];

export const ContextMenu: ContextMenuComponent = React.memo(
	React.forwardRef<ViewInstance, ContextMenuProps<string>>(function ContextMenu(
		{ children, items, onSelect, title, open, onOpenChange, header, footer, disabled = false, accessibilityHint = "Long press for actions", className, testID },
		ref,
	): React.JSX.Element {
		const [ownOpen, setOwnOpen] = React.useState(false);
		const isOpen = open ?? ownOpen;
		const change = React.useCallback(
			(next: boolean): void => {
				setOwnOpen(next);
				onOpenChange?.(next);
			},
			[onOpenChange],
		);
		const show = React.useCallback((): void => {
			change(true);
		}, [change]);
		const hide = React.useCallback((): void => {
			change(false);
		}, [change]);
		const act = React.useCallback(
			(event: AccessibilityActionEvent): void => {
				if (event.nativeEvent.actionName === "longpress") {
					show();
				}
			},
			[show],
		);
		const accessibilityState = React.useMemo(() => ({ disabled, expanded: isOpen }), [disabled, isOpen]);
		return (
			<>
				<Pressable
					ref={ref}
					accessibilityRole="button"
					accessibilityLabel={title}
					accessibilityHint={accessibilityHint}
					accessibilityState={accessibilityState}
					accessibilityActions={LONG_PRESS_ACTIONS}
					onAccessibilityAction={act}
					disabled={disabled}
					onLongPress={show}
					testID={testID}
					className={cn(contextMenuAreaVariants({ state: disabled ? "disabled" : "default" }), className)}>
					{children}
				</Pressable>
				<DropdownMenuSheet
					visible={isOpen}
					title={title}
					items={items}
					onSelect={onSelect}
					onClose={hide}
					header={header}
					footer={footer}
					testID={testID === undefined ? undefined : `${testID}-sheet`}
				/>
			</>
		);
	}),
);
