// The labelled field every calendar picker opens from (DateField,
// MultiDateField): it shows what is picked (or a placeholder) with a calendar
// icon, and pressing it opens a bottom sheet the picker fills. A validation
// message or a hint goes under it, as on TextField. Whether the sheet is open
// is the field's own display state; the picker's sheet content is mounted
// only while open, so every opening starts from the field's value.

import CalendarIcon from "lucide-react-native/icons/calendar";
import * as React from "react";
import { Pressable, Text, View } from "react-native";

import { BottomSheet } from "./bottom-sheet";
import { Icon } from "./icon";
import { ErrorText, Label, MutedText } from "./text";

export interface CalendarFieldProps {
	/** Visible label, the sheet's title and the field's accessible name. */
	readonly label: string;
	/** What is picked, as shown in the field, or `null` for nothing. */
	readonly summary: string | null;
	/** Shown while nothing is picked. */
	readonly placeholder: string;
	/** The first validation message, or nothing. */
	readonly error?: string | undefined;
	/** A hint under the field. */
	readonly hint?: string;
	readonly disabled?: boolean;
	/** Fired when the sheet closes, picked or not (a form marks the field touched). */
	readonly onBlur?: () => void;
	/** The sheet's content; `close` closes the sheet. */
	readonly renderSheet: (close: () => void) => React.ReactNode;
	readonly testID?: string;
}

export function CalendarField({ label, summary, placeholder, error, hint, disabled = false, onBlur, renderSheet, testID }: CalendarFieldProps): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const hasError = error !== undefined && error.length > 0;
	const openSheet = React.useCallback((): void => {
		setOpen(true);
	}, []);
	const close = React.useCallback((): void => {
		setOpen(false);
		onBlur?.();
	}, [onBlur]);

	return (
		<View className="gap-1.5">
			<Label>{label}</Label>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={`${label}, ${summary ?? "none picked"}`}
				accessibilityHint="Opens the calendar"
				accessibilityState={{ expanded: open, disabled }}
				disabled={disabled}
				onPress={openSheet}
				testID={testID}
				className={`min-h-12 flex-row items-center gap-3 rounded-xl border bg-card px-3.5 py-2.5 active:opacity-70 ${hasError ? "border-destructive" : "border-input"} ${disabled ? "opacity-50" : ""}`}>
				<Text className={`flex-1 font-sans text-base ${summary === null ? "text-muted-foreground" : "text-foreground"}`} numberOfLines={2}>
					{summary ?? placeholder}
				</Text>
				<Icon icon={CalendarIcon} size="md" colorClassName="accent-muted-foreground" />
			</Pressable>
			{hasError ? <ErrorText>{error}</ErrorText> : hint === undefined ? null : <MutedText>{hint}</MutedText>}
			<BottomSheet visible={open} title={label} onClose={close} {...(testID === undefined ? {} : { testID: `${testID}-sheet` })}>
				{open ? renderSheet(close) : null}
			</BottomSheet>
		</View>
	);
}
