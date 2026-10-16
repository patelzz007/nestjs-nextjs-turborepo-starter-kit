"use client";

// Ported from ReUI (https://reui.io/r/base-vega/number-field.json), a styled
// base-ui NumberField. Part names, props (`size` on the root and every part,
// `label` on the scrub area) and `data-slot` attributes match ReUI, so its
// examples apply, with these deliberate deviations:
// - Every part forwards its ref.
// - Heights follow the kit's input scale (sm h-8 / default h-9 / lg h-10) so a
//   number field lines up with an `Input` of the same size.
// - `disabled` and `aria-invalid` on the root drive a CVA `state` axis on the
//   group, and the input inherits `aria-invalid`.
// - The stepper buttons' accessible names come from the `numberField` family
//   of `UiKitLabelsProvider` (base-ui hardcodes English "Increase"/"Decrease").
// - The scrub cursor reads theme tokens instead of black / white.
import { NumberField as NumberFieldPrimitive } from "@base-ui/react/number-field";
import { Label } from "@workspace/ui/components/label";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { cn } from "@workspace/ui/lib/core/utils";
import { resolveFieldState, type FieldState } from "@workspace/ui/lib/form/field-state";
import { fieldStateVariants } from "@workspace/ui/lib/form/field-variants";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { cva, type VariantProps } from "class-variance-authority";
import { MinusIcon, PlusIcon } from "lucide-react";
import * as React from "react";

/** Copy for the number field — the `numberField` family of `UiKitLabels`. */
export interface NumberFieldLabels {
	/** Accessible name of the increment button. */
	readonly increment: string;
	/** Accessible name of the decrement button. */
	readonly decrement: string;
}

export type NumberFieldSize = "sm" | "default" | "lg";

interface NumberFieldContextValue {
	readonly fieldId: string;
	readonly size: NumberFieldSize;
	readonly state: FieldState;
	readonly invalid: boolean;
	readonly labels: NumberFieldLabels;
}

const NumberFieldContext = React.createContext<NumberFieldContextValue | null>(null);

function useNumberFieldContext(part: string): NumberFieldContextValue {
	const context = React.useContext(NumberFieldContext);
	if (context === null) {
		throw new Error(`${part} must be used within a NumberField component.`);
	}
	return context;
}

const numberFieldGroupVariants = cva(
	"relative flex w-full justify-between rounded-md border border-input bg-transparent shadow-xs transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 focus-within:has-aria-invalid:border-destructive focus-within:has-aria-invalid:ring-destructive/20 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:focus-within:has-aria-invalid:ring-destructive/40 dark:aria-invalid:ring-destructive/40 data-disabled:pointer-events-none data-disabled:opacity-50",
	{
		variants: {
			size: {
				sm: "h-8 text-sm",
				default: "h-9 text-sm",
				lg: "h-10 text-sm",
			},
			state: fieldStateVariants.state,
		},
		defaultVariants: {
			size: "default",
			state: "default",
		},
	},
);

const numberFieldButtonVariants = cva(
	"relative flex shrink-0 cursor-pointer items-center justify-center transition-colors outline-none hover:bg-accent focus-visible:bg-accent disabled:cursor-not-allowed pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11",
	{
		variants: {
			size: {
				sm: "px-2 [&_svg:not([class*='size-'])]:size-3.5",
				default: "px-2.5 [&_svg:not([class*='size-'])]:size-4",
				lg: "px-3 [&_svg:not([class*='size-'])]:size-4",
			},
		},
		defaultVariants: {
			size: "default",
		},
	},
);

const numberFieldInputVariants = cva("w-full min-w-0 flex-1 bg-transparent text-center tabular-nums outline-none", {
	variants: {
		size: {
			sm: "px-2 py-0.5",
			default: "px-2.5 py-1",
			lg: "px-2.5 py-1.5",
		},
	},
	defaultVariants: {
		size: "default",
	},
});

type NumberFieldProps = NumberFieldPrimitive.Root.Props &
	Omit<VariantProps<typeof numberFieldGroupVariants>, "state"> & {
		/** Per-usage overrides of the `numberField` copy from `UiKitLabelsProvider`. */
		readonly labels?: UiKitLabelsOverride<"numberField"> | undefined;
	};

const NumberField = React.forwardRef<HTMLDivElement, NumberFieldProps>(function NumberField(
	{ id, className, size, disabled, labels: labelsOverride, "aria-invalid": ariaInvalid, ...props },
	ref,
): React.JSX.Element {
	const generatedId = React.useId();
	const fieldId = id ?? generatedId;
	const sizeValue = size ?? "default";
	const labels = useUiKitLabels("numberField", labelsOverride);
	const state = resolveFieldState({ disabled, ariaInvalid });
	const invalid = state === "error";

	const contextValue = React.useMemo<NumberFieldContextValue>(() => ({ fieldId, size: sizeValue, state, invalid, labels }), [fieldId, sizeValue, state, invalid, labels]);

	return (
		<NumberFieldContext.Provider value={contextValue}>
			<NumberFieldPrimitive.Root
				ref={ref}
				className={cn("flex w-full flex-col items-start gap-2", className)}
				data-size={sizeValue}
				data-slot="number-field"
				id={fieldId}
				disabled={disabled}
				{...props}
			/>
		</NumberFieldContext.Provider>
	);
});

type NumberFieldGroupProps = NumberFieldPrimitive.Group.Props & Omit<VariantProps<typeof numberFieldGroupVariants>, "state">;

const NumberFieldGroup = React.forwardRef<HTMLDivElement, NumberFieldGroupProps>(function NumberFieldGroup({ className, size: sizeProp, ...props }, ref): React.JSX.Element {
	const context = useNumberFieldContext("NumberFieldGroup");
	const size = sizeProp ?? context.size;

	return (
		<NumberFieldPrimitive.Group
			ref={ref}
			className={cn(numberFieldGroupVariants({ size, state: context.state }), className)}
			aria-invalid={context.invalid || undefined}
			data-slot="number-field-group"
			{...props}
		/>
	);
});

type NumberFieldDecrementProps = NumberFieldPrimitive.Decrement.Props & VariantProps<typeof numberFieldButtonVariants>;

const NumberFieldDecrement = React.forwardRef<HTMLButtonElement, NumberFieldDecrementProps>(function NumberFieldDecrement(
	{ className, size: sizeProp, children, ...props },
	ref,
): React.JSX.Element {
	const context = useNumberFieldContext("NumberFieldDecrement");
	const size = sizeProp ?? context.size;

	return (
		<NumberFieldPrimitive.Decrement
			ref={ref}
			aria-label={context.labels.decrement}
			className={cn(numberFieldButtonVariants({ size }), "rounded-s-md border-e-0", className)}
			data-slot="number-field-decrement"
			{...props}>
			{children ?? <MinusIcon aria-hidden />}
		</NumberFieldPrimitive.Decrement>
	);
});

type NumberFieldIncrementProps = NumberFieldPrimitive.Increment.Props & VariantProps<typeof numberFieldButtonVariants>;

const NumberFieldIncrement = React.forwardRef<HTMLButtonElement, NumberFieldIncrementProps>(function NumberFieldIncrement(
	{ className, size: sizeProp, children, ...props },
	ref,
): React.JSX.Element {
	const context = useNumberFieldContext("NumberFieldIncrement");
	const size = sizeProp ?? context.size;

	return (
		<NumberFieldPrimitive.Increment
			ref={ref}
			aria-label={context.labels.increment}
			className={cn(numberFieldButtonVariants({ size }), "rounded-e-md border-s-0", className)}
			data-slot="number-field-increment"
			{...props}>
			{children ?? <PlusIcon aria-hidden />}
		</NumberFieldPrimitive.Increment>
	);
});

type NumberFieldInputProps = Omit<NumberFieldPrimitive.Input.Props, "size"> & VariantProps<typeof numberFieldInputVariants>;

const NumberFieldInput = React.forwardRef<HTMLInputElement, NumberFieldInputProps>(function NumberFieldInput({ className, size: sizeProp, ...props }, ref): React.JSX.Element {
	const context = useNumberFieldContext("NumberFieldInput");
	const size = sizeProp ?? context.size;

	return (
		<NumberFieldPrimitive.Input
			ref={ref}
			aria-invalid={context.invalid || undefined}
			className={cn(numberFieldInputVariants({ size }), className)}
			data-slot="number-field-input"
			{...props}
		/>
	);
});

type NumberFieldScrubAreaProps = NumberFieldPrimitive.ScrubArea.Props & {
	/** The visible label, also the field's accessible name. */
	readonly label: string;
};

function CursorGrowIcon(props: React.ComponentProps<"svg">): React.JSX.Element {
	return (
		<svg aria-hidden height="14" viewBox="0 0 24 14" width="26" xmlns="http://www.w3.org/2000/svg" {...props}>
			<path d="M19.5 5.5L6.49737 5.51844V2L1 6.9999L6.5 12L6.49737 8.5L19.5 8.5V12L25 6.9999L19.5 2V5.5Z" />
		</svg>
	);
}

const NumberFieldScrubArea = React.forwardRef<HTMLSpanElement, NumberFieldScrubAreaProps>(function NumberFieldScrubArea(
	{ className, label, ...props },
	ref,
): React.JSX.Element {
	const context = useNumberFieldContext("NumberFieldScrubArea");

	return (
		<NumberFieldPrimitive.ScrubArea ref={ref} className={cn("flex cursor-ew-resize", className)} data-slot="number-field-scrub-area" {...props}>
			<Label className="cursor-ew-resize" htmlFor={context.fieldId}>
				{label}
			</Label>
			<NumberFieldPrimitive.ScrubAreaCursor className="fill-foreground stroke-background drop-shadow-sm">
				<CursorGrowIcon />
			</NumberFieldPrimitive.ScrubAreaCursor>
		</NumberFieldPrimitive.ScrubArea>
	);
});

export { NumberField, NumberFieldDecrement, NumberFieldGroup, NumberFieldIncrement, NumberFieldInput, NumberFieldScrubArea, numberFieldGroupVariants };
export type { NumberFieldDecrementProps, NumberFieldGroupProps, NumberFieldIncrementProps, NumberFieldInputProps, NumberFieldProps, NumberFieldScrubAreaProps };
