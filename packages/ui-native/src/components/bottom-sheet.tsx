// A sheet that slides up over the screen: a title with a close button, then
// whatever the caller puts in it — options to pick from, a history, a form.
// The phone form of the web kit's Sheet and Drawer. Tapping the dimmed
// backdrop, the close button or the system back closes it.
// It rises above the keyboard on both platforms (keyboard-avoiding-view.tsx:
// the sheet is a Modal, its own window), and what is under the title scrolls,
// so a field low in a tall sheet can still be brought into view above it — in
// the sheet's own scroll view, or, for content that is a virtualized list
// (`scrollsItself`), in that list: a list is never nested in a scroll view.
// It slides in, and simply appears under Reduce Motion.
// Presentational and controlled: the caller owns `visible` and is told when
// the sheet asks to close.

import { cva, type VariantProps } from "class-variance-authority";
import CheckIcon from "lucide-react-native/icons/check";
import XIcon from "lucide-react-native/icons/x";
import * as React from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";

import { cn } from "../lib/cn";
import { isInactiveState, resolveControlState } from "../lib/control-state";
import { useReduceMotion } from "../lib/use-reduce-motion";
import { Icon } from "./icon";
import { KeyboardAvoidingView } from "./keyboard-avoiding-view";
import { Subheading } from "./text";

export const bottomSheetVariants = cva("gap-3 rounded-t-2xl border border-border bg-popover pt-4", {
	variants: {
		variant: { default: "" },
		/** How tall the sheet may grow before its body scrolls: `md` four fifths of the screen, `lg` nearly all of it. */
		size: { md: "max-h-4/5", lg: "max-h-11/12" },
		state: { default: "", loading: "", disabled: "", error: "" },
	},
	defaultVariants: { variant: "default", size: "md", state: "default" },
});

type BottomSheetVariantProps = VariantProps<typeof bottomSheetVariants>;
export type BottomSheetVariant = NonNullable<BottomSheetVariantProps["variant"]>;
export type BottomSheetSize = NonNullable<BottomSheetVariantProps["size"]>;

/** The backdrop's generic name for touch-exploration users. */
const DEFAULT_CLOSE_LABEL = "Close";
/** The 44 pt close button's extra touch area around its glyph (rules/04). */
const CLOSE_HIT_SLOP = 8;

export interface BottomSheetProps {
	readonly visible: boolean;
	/** The sheet's heading, and its close button's name ("Close filter"). */
	readonly title: string;
	readonly onClose: () => void;
	readonly children: React.ReactNode;
	/**
	 * The content scrolls itself (a `FlatList`, with anything fixed above it): the
	 * sheet only sizes it to the room left, and does not wrap it in a scroll view.
	 */
	readonly scrollsItself?: boolean;
	readonly variant?: BottomSheetVariant;
	readonly size?: BottomSheetSize;
	/** The backdrop's accessible name (default "Close"). */
	readonly closeLabel?: string;
	/** Extra classes for the sheet, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

export const BottomSheet = React.memo(
	React.forwardRef<View, BottomSheetProps>(function BottomSheet(
		{ visible, title, onClose, children, scrollsItself = false, variant = "default", size = "md", closeLabel = DEFAULT_CLOSE_LABEL, className, testID },
		ref,
	): React.JSX.Element {
		const reduceMotion = useReduceMotion();
		const bodyTestID = testID === undefined ? undefined : `${testID}-body`;
		return (
			<Modal visible={visible} transparent animationType={reduceMotion ? "none" : "slide"} onRequestClose={onClose}>
				<KeyboardAvoidingView className="flex-1 justify-end" testID={testID === undefined ? undefined : `${testID}-keyboard`}>
					<Pressable accessibilityRole="button" accessibilityLabel={closeLabel} onPress={onClose} className="absolute inset-0 bg-scrim opacity-50" />
					<View ref={ref} accessibilityViewIsModal testID={testID} className={cn(bottomSheetVariants({ variant, size }), className)}>
						<View className="flex-row items-center justify-between px-4">
							<Subheading>{title}</Subheading>
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={`Close ${title.toLowerCase()}`}
								onPress={onClose}
								hitSlop={CLOSE_HIT_SLOP}
								className="size-11 items-center justify-center rounded-full active:opacity-60">
								<Icon icon={XIcon} size="md" colorClassName="accent-muted-foreground" />
							</Pressable>
						</View>
						{/* Shrinks to the room the sheet has left above the keyboard, then scrolls. */}
						{scrollsItself ? (
							<View className="shrink gap-3 px-4 pb-8" testID={bodyTestID}>
								{children}
							</View>
						) : (
							<ScrollView keyboardShouldPersistTaps="handled" className="shrink grow-0" contentContainerClassName="px-4 pb-8" testID={bodyTestID}>
								{children}
							</ScrollView>
						)}
					</View>
				</KeyboardAvoidingView>
			</Modal>
		);
	}),
);

export const sheetOptionRowVariants = cva("min-h-12 flex-row items-center gap-3 border-b border-border py-3 active:opacity-70", {
	variants: {
		variant: { default: "" },
		size: { md: "" },
		state: { default: "", loading: "opacity-60", disabled: "opacity-60", error: "" },
	},
	defaultVariants: { variant: "default", size: "md", state: "default" },
});

export const sheetOptionRowLabelVariants = cva("text-base text-foreground", {
	variants: {
		selected: { true: "font-sans-semibold", false: "font-sans" },
	},
	defaultVariants: { selected: false },
});

/**
 * A handler told which value was chosen. Its parameter is checked bivariantly
 * (the technique of React's own `EventHandler` type), so a row of a narrower
 * value type (`"merge" | "squash"`) still fits the one memoized, ref-forwarding
 * component below — `forwardRef` / `memo` cannot carry a type parameter. Safe:
 * the row only ever calls it with its own `value`.
 */
export type OptionSelectHandler<TValue extends string> = BivariantSelect<TValue>["select"];

interface BivariantSelect<TValue extends string> {
	select(value: TValue): void;
}

export interface SheetOptionRowProps<TValue extends string> {
	readonly value: TValue;
	readonly label: string;
	/** A second line under the label. */
	readonly description?: string | undefined;
	readonly selected: boolean;
	readonly disabled?: boolean;
	/** The row was chosen; called with its own `value`. */
	readonly onSelect: OptionSelectHandler<TValue>;
	/** Extra classes for the row, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** `SheetOptionRow`'s call signature: generic over the value, which `forwardRef` / `memo` alone would erase. */
export type SheetOptionRowComponent = <TValue extends string>(props: SheetOptionRowProps<TValue> & React.RefAttributes<View>) => React.ReactNode;

/** One choice in a sheet: a radio row, its label bold and ticked while chosen. */
export const SheetOptionRow: SheetOptionRowComponent = React.memo(
	React.forwardRef<View, SheetOptionRowProps<string>>(function SheetOptionRow(
		{ value, label, description, selected, disabled = false, onSelect, className, testID },
		ref,
	): React.JSX.Element {
		const state = resolveControlState({ disabled });
		const isInactive = isInactiveState(state);
		const accessibilityState = React.useMemo(() => ({ checked: selected, disabled: isInactive }), [isInactive, selected]);
		const select = React.useCallback((): void => {
			onSelect(value);
		}, [onSelect, value]);
		return (
			<Pressable
				ref={ref}
				accessibilityRole="radio"
				accessibilityLabel={label}
				accessibilityHint={description}
				accessibilityState={accessibilityState}
				disabled={isInactive}
				onPress={select}
				testID={testID}
				className={cn(sheetOptionRowVariants({ state }), className)}>
				<View className="flex-1 gap-0.5">
					<Text className={sheetOptionRowLabelVariants({ selected })}>{label}</Text>
					{description === undefined ? null : <Text className="font-sans text-sm text-muted-foreground">{description}</Text>}
				</View>
				{selected ? <Icon icon={CheckIcon} size="md" colorClassName="accent-primary" /> : null}
			</Pressable>
		);
	}),
);
