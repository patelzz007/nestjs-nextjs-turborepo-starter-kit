"use client";

import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import { cn } from "@workspace/ui/lib/core/utils";
import { resolveFieldState } from "@workspace/ui/lib/form/field-state";
import { fieldStateVariants } from "@workspace/ui/lib/form/field-variants";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

const radioGroupItemVariants = cva(
	"group/radio-group-item peer relative flex aspect-square shrink-0 items-center justify-center rounded-full border border-input outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground dark:data-checked:bg-primary",
	{
		variants: {
			variant: {
				default: "",
			},
			size: {
				default: "size-4 **:data-[slot=radio-group-dot]:size-2 *:data-[slot=radio-group-indicator]:size-4",
				sm: "size-3.5 **:data-[slot=radio-group-dot]:size-1.5 *:data-[slot=radio-group-indicator]:size-3.5",
				lg: "size-5 **:data-[slot=radio-group-dot]:size-2.5 *:data-[slot=radio-group-indicator]:size-5",
			},
			state: fieldStateVariants.state,
		},
		defaultVariants: {
			variant: "default",
			size: "default",
			state: "default",
		},
	},
);

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupPrimitive.Props>(function RadioGroup({ className, ...props }, ref): React.JSX.Element {
	return <RadioGroupPrimitive ref={ref} data-slot="radio-group" className={cn("grid w-full gap-3", className)} {...props} />;
});

type RadioGroupItemProps = RadioPrimitive.Root.Props &
	Omit<VariantProps<typeof radioGroupItemVariants>, "state"> & {
		/** Shows the busy treatment and blocks interaction while the option's data settles. */
		readonly loading?: boolean;
	};

const RadioGroupItem = React.forwardRef<HTMLElement, RadioGroupItemProps>(function RadioGroupItem(
	{ className, variant, size, loading = false, disabled, "aria-invalid": ariaInvalid, ...props },
	ref,
): React.JSX.Element {
	const state = resolveFieldState({ disabled, loading, ariaInvalid });

	return (
		<RadioPrimitive.Root
			ref={ref}
			data-slot="radio-group-item"
			data-loading={loading ? "" : undefined}
			disabled={disabled === true || loading}
			aria-invalid={ariaInvalid}
			className={cn(radioGroupItemVariants({ variant, size, state }), className)}
			{...props}>
			<RadioPrimitive.Indicator data-slot="radio-group-indicator" className="flex items-center justify-center">
				<span data-slot="radio-group-dot" className="absolute start-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-foreground rtl:translate-x-1/2" />
			</RadioPrimitive.Indicator>
		</RadioPrimitive.Root>
	);
});

export { RadioGroup, RadioGroupItem, radioGroupItemVariants };
export type { RadioGroupItemProps };
