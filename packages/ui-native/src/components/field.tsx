// A form field's frame: its label, the control (passed as `children`), a hint
// and the validation message. Data-agnostic and controlled: it renders the
// message it is given and never validates (that is the form's zod schema).
//
// The field shares what it knows with the control inside it through
// `FieldContext`: an `Input`, `Textarea`, `InputGroup`, `PasswordInput` or
// `InputOTP` placed in a `Field` is named by the field's label, described by
// its hint, and takes the field's invalid / disabled / loading state — with
// no props repeated. A control's own props still win.
//
// The parts (`FieldLabel`, `FieldHint`, `FieldError`) are exported for a
// custom layout, as the web kit's `Field` parts are.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { type TextInstance, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { resolveControlState, type ControlState } from "../lib/control-state";
import { ErrorText, Label, MutedText } from "./text";

export const fieldVariants = cva("", {
	variants: {
		variant: {
			default: "",
		},
		/** The space between the label, the control and the messages. */
		size: {
			md: "gap-1.5",
			sm: "gap-1",
		},
		state: {
			default: "",
			loading: "",
			disabled: "",
			error: "",
		},
	},
	defaultVariants: { variant: "default", size: "md", state: "default" },
});

export const fieldLabelVariants = cva("", {
	variants: {
		state: {
			default: "text-foreground",
			loading: "text-foreground",
			/** An inactive field's label recedes with its control. */
			disabled: "text-muted-foreground",
			/** The message below carries the error colour; the label stays readable. */
			error: "text-foreground",
		},
	},
	defaultVariants: { state: "default" },
});

type FieldVariantProps = VariantProps<typeof fieldVariants>;
export type FieldVariant = NonNullable<FieldVariantProps["variant"]>;
export type FieldSize = NonNullable<FieldVariantProps["size"]>;

/** What a field tells the control inside it. */
export interface FieldContextValue {
	/** The visible label: the control's accessible name. */
	readonly label: string | undefined;
	/** The hint: the control's accessibility hint. */
	readonly hint: string | undefined;
	/** The label's `nativeID`, for `accessibilityLabelledBy` (Android). */
	readonly labelId: string;
	readonly state: ControlState;
	readonly invalid: boolean;
	readonly disabled: boolean;
	readonly loading: boolean;
}

export const FieldContext = React.createContext<FieldContextValue | null>(null);

/** The enclosing field, or `null` when the control stands alone. */
export function useFieldContext(): FieldContextValue | null {
	return React.useContext(FieldContext);
}

/** Whether a message is worth rendering: an empty string means "no error". */
function hasContent(children: React.ReactNode): boolean {
	return children !== undefined && children !== null && children !== false && children !== "";
}

export interface FieldProps {
	/** Visible label and the control's accessible name. */
	readonly label?: string | undefined;
	/** A hint under the control (format, rules). */
	readonly hint?: string | undefined;
	/** The first validation message, or nothing. A non-empty message makes the field invalid. */
	readonly error?: string | undefined;
	/** The caller's validation outcome, when the message is shown elsewhere. */
	readonly invalid?: boolean | undefined;
	readonly disabled?: boolean | undefined;
	readonly loading?: boolean | undefined;
	readonly variant?: FieldVariant | undefined;
	readonly size?: FieldSize | undefined;
	/** The control: an `Input`, `Textarea`, `InputGroup`, `PasswordInput`, `InputOTP`, … */
	readonly children: React.ReactNode;
	/** Extra classes for the container, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

export const Field = React.memo(
	React.forwardRef<ViewInstance, FieldProps>(function Field(
		{ label, hint, error, invalid = false, disabled = false, loading = false, variant = "default", size = "md", children, className, testID },
		ref,
	): React.JSX.Element {
		const labelId = React.useId();
		const hasError = invalid || hasContent(error);
		const state = resolveControlState({ disabled, loading, invalid: hasError });
		const context = React.useMemo(
			(): FieldContextValue => ({ label, hint, labelId, state, invalid: hasError, disabled, loading }),
			[disabled, hasError, hint, label, labelId, loading, state],
		);
		return (
			<FieldContext.Provider value={context}>
				<View ref={ref} testID={testID} className={cn(fieldVariants({ variant, size, state }), className)}>
					{label === undefined ? null : <FieldLabel>{label}</FieldLabel>}
					{children}
					{hint === undefined ? null : <FieldHint>{hint}</FieldHint>}
					<FieldError>{error}</FieldError>
				</View>
			</FieldContext.Provider>
		);
	}),
);

export interface FieldPartProps {
	readonly children?: React.ReactNode | undefined;
	/** Extra classes, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** The field's label. Inside a `Field` it carries the id the control is labelled by. */
export const FieldLabel = React.memo(
	React.forwardRef<TextInstance, FieldPartProps>(function FieldLabel({ children, className, testID }, ref): React.JSX.Element {
		const field = useFieldContext();
		return (
			<Label ref={ref} nativeID={field?.labelId} testID={testID} className={cn(fieldLabelVariants({ state: field?.state ?? "default" }), className)}>
				{children}
			</Label>
		);
	}),
);

/** A hint under the control (format, rules). */
export const FieldHint = React.memo(
	React.forwardRef<TextInstance, FieldPartProps>(function FieldHint({ children, className, testID }, ref): React.JSX.Element {
		return (
			<MutedText ref={ref} testID={testID} className={cn(className)}>
				{children}
			</MutedText>
		);
	}),
);

/** The validation message, announced politely as an alert. Renders nothing without a message. */
export const FieldError = React.memo(
	React.forwardRef<TextInstance, FieldPartProps>(function FieldError({ children, className, testID }, ref): React.JSX.Element | null {
		if (!hasContent(children)) {
			return null;
		}
		return (
			<ErrorText ref={ref} accessibilityRole="alert" accessibilityLiveRegion="polite" testID={testID} className={cn(className)}>
				{children}
			</ErrorText>
		);
	}),
);
