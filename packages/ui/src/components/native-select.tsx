// Ported from shadcn/ui (base-vega `native-select`): the platform `<select>`,
// styled like the kit's inputs — for long, simple lists and for mobile, where
// the OS picker beats a custom popup. Part names, `size` and `data-slot`
// values match shadcn, with these deliberate deviations:
// - The ref forwards to the `<select>` itself (not the wrapper), so forms
//   and focus management reach the control.
// - Visual state is a CVA `state` axis from `resolveFieldState` (disabled /
//   loading / `aria-invalid`), like every kit form control.
// - `className` still lands on the wrapper (as in shadcn) — width and layout
//   belong there; `selectClassName` reaches the `<select>`.
"use client";

import { resolveFieldState } from "@workspace/ui/lib/form/field-state";
import { cn } from "@workspace/ui/lib/core/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { ChevronDownIcon } from "lucide-react";
import * as React from "react";

const nativeSelectVariants = cva(
	"w-full min-w-0 appearance-none rounded-md border border-input bg-transparent py-1 pr-8 pl-2.5 text-sm shadow-xs transition-[color,box-shadow] outline-none select-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed dark:bg-input/30 dark:hover:bg-input/50",
	{
		variants: {
			size: {
				default: "h-9",
				sm: "h-8",
			},
			state: {
				default: "",
				loading: "pointer-events-none",
				disabled: "pointer-events-none cursor-not-allowed",
				error: "border-destructive ring-3 ring-destructive/20 dark:border-destructive/50 dark:ring-destructive/40",
			},
		},
		defaultVariants: {
			size: "default",
			state: "default",
		},
	},
);

type NativeSelectSize = NonNullable<VariantProps<typeof nativeSelectVariants>["size"]>;

interface NativeSelectProps extends Omit<React.ComponentProps<"select">, "size"> {
	readonly size?: NativeSelectSize | undefined;
	/** Busy (options loading): dims the control and blocks interaction. */
	readonly loading?: boolean | undefined;
	/** Classes for the `<select>` element; `className` styles the wrapper. */
	readonly selectClassName?: string | undefined;
}

const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(function NativeSelect(
	{ className, selectClassName, size = "default", loading = false, disabled, "aria-invalid": ariaInvalid, ...props },
	ref,
): React.JSX.Element {
	const state = resolveFieldState({ disabled, loading, ariaInvalid });

	return (
		<div
			data-slot="native-select-wrapper"
			data-size={size}
			data-state={state}
			className={cn("group/native-select relative w-fit has-[select:disabled]:opacity-50 data-[state=loading]:opacity-60", className)}>
			<select
				ref={ref}
				data-slot="native-select"
				data-size={size}
				data-loading={loading ? "" : undefined}
				disabled={disabled}
				aria-invalid={ariaInvalid}
				aria-busy={loading ? true : undefined}
				className={cn(nativeSelectVariants({ size, state }), selectClassName)}
				{...props}
			/>
			<ChevronDownIcon
				aria-hidden="true"
				data-slot="native-select-icon"
				className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground select-none"
			/>
		</div>
	);
});

/** An `<option>` painted with the system canvas colours, so the OS popup stays legible in both themes. */
const NativeSelectOption = React.forwardRef<HTMLOptionElement, React.ComponentProps<"option">>(function NativeSelectOption({ className, ...props }, ref): React.JSX.Element {
	return <option ref={ref} data-slot="native-select-option" className={cn("bg-[Canvas] text-[CanvasText]", className)} {...props} />;
});

/** An `<optgroup>` (its `label` names the group), painted like `NativeSelectOption`. */
const NativeSelectOptGroup = React.forwardRef<HTMLOptGroupElement, React.ComponentProps<"optgroup">>(function NativeSelectOptGroup(
	{ className, ...props },
	ref,
): React.JSX.Element {
	return <optgroup ref={ref} data-slot="native-select-optgroup" className={cn("bg-[Canvas] text-[CanvasText]", className)} {...props} />;
});

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption, nativeSelectVariants, type NativeSelectProps, type NativeSelectSize };
