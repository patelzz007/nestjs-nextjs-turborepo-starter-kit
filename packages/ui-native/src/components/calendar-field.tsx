// The labelled field every calendar picker opens from (DateField,
// MultiDateField): it shows what is picked (or a placeholder) with a calendar
// icon, and pressing it opens a bottom sheet the picker fills. A validation
// message or a hint goes under it, as on TextField. Whether the sheet is open
// is the field's own display state; the picker's sheet content is mounted
// only while open, so every opening starts from the field's value.
//
// The field contract: opening the sheet is the field's focus (`onFocus`),
// closing it — picked or not — its blur (`onBlur`, a form marks the field
// touched). The trigger's look comes from CVA (`variant`, `size`, `state`);
// `state` is derived from `disabled`, `loading` and `invalid` (or an `error`
// message) by resolveControlState. The ref reaches the trigger.

import { cva, type VariantProps } from "class-variance-authority";
import CalendarIcon from "lucide-react-native/icons/calendar";
import * as React from "react";
import { ActivityIndicator, Pressable, Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { isInactiveState, resolveControlState } from "../lib/control-state";
import { BottomSheet } from "./bottom-sheet";
import { Icon } from "./icon";
import { ErrorText, Label, MutedText } from "./text";

export const calendarFieldTriggerVariants = cva("flex-row items-center gap-3 border active:opacity-70", {
	variants: {
		/** `outline`: a bordered card, as TextField (the default). `filled`: a muted well with no visible border. */
		variant: {
			outline: "border-input bg-card",
			filled: "border-transparent bg-muted",
		},
		/** `md`: a form's field. `sm`: a compact field (a filter bar); still 44 pt tall. */
		size: {
			md: "min-h-12 rounded-xl px-3.5 py-2.5",
			sm: "min-h-11 rounded-lg px-3 py-2",
		},
		state: {
			default: "",
			loading: "opacity-60",
			disabled: "opacity-50",
			error: "border-destructive",
		},
	},
	defaultVariants: { variant: "outline", size: "md", state: "default" },
});

export const calendarFieldValueVariants = cva("flex-1 font-sans", {
	variants: {
		size: { md: "text-base", sm: "text-sm" },
		/** Something is picked (`value`) or the placeholder shows. */
		content: { value: "text-foreground", placeholder: "text-muted-foreground" },
	},
	defaultVariants: { size: "md", content: "value" },
});

type CalendarFieldTriggerVariantProps = VariantProps<typeof calendarFieldTriggerVariants>;
export type CalendarFieldVariant = NonNullable<CalendarFieldTriggerVariantProps["variant"]>;
export type CalendarFieldSize = NonNullable<CalendarFieldTriggerVariantProps["size"]>;

/** The summary wraps to two lines at most, so a long list of days never grows the field without end. */
const SUMMARY_MAX_LINES = 2;

/**
 * The props every calendar field shares with the pickers built on it
 * (DateField, MultiDateField pass them straight through).
 */
export interface CalendarFieldTriggerProps {
	/** Visible label, the sheet's title and the field's accessible name. */
	readonly label: string;
	/** Shown while nothing is picked — supplied by the caller. */
	readonly placeholder: string;
	/** The first validation message, or nothing. Shown under the field, and marks it invalid. */
	readonly error?: string | undefined;
	/** The caller's validation outcome without a message of its own. */
	readonly invalid?: boolean | undefined;
	/** A hint under the field. */
	readonly hint?: string | undefined;
	readonly disabled?: boolean | undefined;
	/** Something the field depends on is loading: a spinner in place of the icon, and it cannot open. */
	readonly loading?: boolean | undefined;
	/** Fired when the sheet opens (the field gains focus). */
	readonly onFocus?: (() => void) | undefined;
	/** Fired when the sheet closes, picked or not (a form marks the field touched). */
	readonly onBlur?: (() => void) | undefined;
	readonly variant?: CalendarFieldVariant | undefined;
	readonly size?: CalendarFieldSize | undefined;
	/** Extra classes for the field's container, merged last (layout: `flex-1`). */
	readonly className?: string | undefined;
	/** The trigger's test ID; the sheet's is `${testID}-sheet`. */
	readonly testID?: string | undefined;
}

export interface CalendarFieldProps extends CalendarFieldTriggerProps {
	/** What is picked, as shown in the field, or `null` for nothing. */
	readonly summary: string | null;
	/** The sheet's content; `close` closes the sheet. */
	readonly renderSheet: (close: () => void) => React.ReactNode;
}

export const CalendarField = React.memo(
	React.forwardRef<ViewInstance, CalendarFieldProps>(function CalendarField(
		{
			label,
			summary,
			placeholder,
			error,
			invalid = false,
			hint,
			disabled = false,
			loading = false,
			onFocus,
			onBlur,
			variant = "outline",
			size = "md",
			className,
			renderSheet,
			testID,
		},
		ref,
	): React.JSX.Element {
		const [open, setOpen] = React.useState(false);
		const hasError = error !== undefined && error.length > 0;
		const state = resolveControlState({ disabled, loading, invalid: invalid || hasError });
		const isInactive = isInactiveState(state);
		const accessibilityState = React.useMemo(() => ({ expanded: open, disabled: isInactive, busy: loading }), [isInactive, loading, open]);
		const openSheet = React.useCallback((): void => {
			setOpen(true);
			onFocus?.();
		}, [onFocus]);
		const close = React.useCallback((): void => {
			setOpen(false);
			onBlur?.();
		}, [onBlur]);

		return (
			<View className={cn("gap-1.5", className)}>
				<Label>{label}</Label>
				<Pressable
					ref={ref}
					accessibilityRole="button"
					accessibilityLabel={`${label}, ${summary ?? "none picked"}`}
					accessibilityHint="Opens the calendar"
					accessibilityState={accessibilityState}
					disabled={isInactive}
					onPress={openSheet}
					testID={testID}
					className={cn(calendarFieldTriggerVariants({ variant, size, state }))}>
					<Text className={calendarFieldValueVariants({ size, content: summary === null ? "placeholder" : "value" })} numberOfLines={SUMMARY_MAX_LINES}>
						{summary ?? placeholder}
					</Text>
					{loading ? (
						<ActivityIndicator size="small" colorClassName="accent-muted-foreground" />
					) : (
						<Icon icon={CalendarIcon} size="md" colorClassName="accent-muted-foreground" />
					)}
				</Pressable>
				{hasError ? <ErrorText>{error}</ErrorText> : hint === undefined ? null : <MutedText>{hint}</MutedText>}
				<BottomSheet visible={open} title={label} onClose={close} {...(testID === undefined ? {} : { testID: `${testID}-sheet` })}>
					{open ? renderSheet(close) : null}
				</BottomSheet>
			</View>
		);
	}),
);
