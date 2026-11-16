import { Input as InputPrimitive } from "@base-ui/react/input";
import { resolveFieldState } from "@workspace/ui/lib/form/field-state";
import { inputVariants } from "@workspace/ui/lib/form/field-variants";
import { cn } from "@workspace/ui/lib/core/utils";
import type { VariantProps } from "class-variance-authority";
import * as React from "react";

type InputProps = Omit<React.ComponentProps<"input">, "size"> &
	VariantProps<typeof inputVariants> & {
		/** Styles the field as busy while something is checked. It does not disable the field; set `disabled` too if typing should stop. */
		readonly loading?: boolean;
	};

/** The kit's single-line text field, a native `input` on Base UI. Every native attribute passes through; `aria-invalid`, `disabled` and `loading` set its state. */
const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
	{ className, type, variant, size, loading = false, disabled, "aria-invalid": ariaInvalid, ...props },
	ref,
): React.JSX.Element {
	const state = resolveFieldState({ disabled, loading, ariaInvalid });

	return (
		<InputPrimitive
			ref={ref}
			type={type}
			data-slot="input"
			disabled={disabled}
			aria-invalid={ariaInvalid}
			data-loading={loading ? "" : undefined}
			className={cn(inputVariants({ variant, size, state }), className)}
			{...props}
		/>
	);
});

export { Input, inputVariants };
export type { InputProps };
