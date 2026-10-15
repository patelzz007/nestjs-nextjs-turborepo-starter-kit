// A sheet that slides up over the screen: a title with a close button, then
// whatever the caller puts in it — options to pick from, a history, a form.
// Tapping the dimmed backdrop, the close button or the system back closes it.
// It rises above the keyboard on both platforms (keyboard-avoiding-view.tsx:
// the sheet is a Modal, its own window), and what is under the title scrolls,
// so a field low in a tall sheet can still be brought into view above it — in
// the sheet's own scroll view, or, for content that is a virtualized list
// (`scrollsItself`), in that list: a list is never nested in a scroll view.
// Presentational and controlled: the caller owns `visible` and is told when
// the sheet asks to close.

import CheckIcon from "lucide-react-native/icons/check";
import XIcon from "lucide-react-native/icons/x";
import * as React from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";

import { Icon } from "./icon";
import { KeyboardAvoidingView } from "./keyboard-avoiding-view";
import { Subheading } from "./text";

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
	readonly testID?: string;
}

export function BottomSheet({ visible, title, onClose, children, scrollsItself = false, testID }: BottomSheetProps): React.JSX.Element {
	const bodyTestID = testID === undefined ? undefined : `${testID}-body`;
	return (
		<Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
			<KeyboardAvoidingView className="flex-1 justify-end" testID={testID === undefined ? undefined : `${testID}-keyboard`}>
				<Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} className="absolute inset-0 bg-scrim opacity-50" />
				<View accessibilityViewIsModal testID={testID} className="max-h-[80%] gap-3 rounded-t-2xl border border-border bg-popover pt-4">
					<View className="flex-row items-center justify-between px-4">
						<Subheading>{title}</Subheading>
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={`Close ${title.toLowerCase()}`}
							onPress={onClose}
							hitSlop={8}
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
}

export interface SheetOptionRowProps<TValue extends string> {
	readonly value: TValue;
	readonly label: string;
	/** A second line under the label. */
	readonly description?: string | undefined;
	readonly selected: boolean;
	readonly onSelect: (value: TValue) => void;
}

/** One choice in a sheet: a radio row, its label bold and ticked while chosen. */
export function SheetOptionRow<TValue extends string>({ value, label, description, selected, onSelect }: SheetOptionRowProps<TValue>): React.JSX.Element {
	const select = React.useCallback((): void => {
		onSelect(value);
	}, [onSelect, value]);
	return (
		<Pressable
			accessibilityRole="radio"
			accessibilityLabel={label}
			accessibilityHint={description}
			accessibilityState={{ checked: selected }}
			onPress={select}
			className="min-h-12 flex-row items-center gap-3 border-b border-border py-3 active:opacity-70">
			<View className="flex-1 gap-0.5">
				<Text className={`text-base text-foreground ${selected ? "font-sans-semibold" : "font-sans"}`}>{label}</Text>
				{description === undefined ? null : <Text className="font-sans text-sm text-muted-foreground">{description}</Text>}
			</View>
			{selected ? <Icon icon={CheckIcon} size="md" colorClassName="accent-primary" /> : null}
		</Pressable>
	);
}
