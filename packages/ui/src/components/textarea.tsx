import { resolveFieldState } from "@workspace/ui/lib/form/field-state";
import { textareaVariants } from "@workspace/ui/lib/form/field-variants";
import { cn } from "@workspace/ui/lib/core/utils";
import type { VariantProps } from "class-variance-authority";
import * as React from "react";

type TextareaProps = React.ComponentProps<"textarea"> &
	VariantProps<typeof textareaVariants> & {
		/** Styles the field as busy. It does not disable it; set `disabled` too if typing should stop. */
		readonly loading?: boolean;
	};

/** The kit's multi-line field, a native `textarea` that grows with its content (`field-sizing: content`); cap it with `max-h-*`. */
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
	{ className, variant, size, loading = false, disabled, "aria-invalid": ariaInvalid, ...props },
	ref,
): React.JSX.Element {
	const state = resolveFieldState({ disabled, loading, ariaInvalid });

	return (
		<textarea
			ref={ref}
			data-slot="textarea"
			disabled={disabled}
			aria-invalid={ariaInvalid}
			data-loading={loading ? "" : undefined}
			className={cn(textareaVariants({ variant, size, state }), className)}
			{...props}
		/>
	);
});

export { Textarea, textareaVariants };
