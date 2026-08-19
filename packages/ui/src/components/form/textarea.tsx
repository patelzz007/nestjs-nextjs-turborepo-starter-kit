import { resolveFieldState } from "@workspace/ui/lib/field-state";
import { textareaVariants } from "@workspace/ui/lib/field-variants";
import { cn } from "@workspace/ui/lib/utils";
import type { VariantProps } from "class-variance-authority";
import * as React from "react";

type TextareaProps = React.ComponentProps<"textarea"> &
	VariantProps<typeof textareaVariants> & {
		readonly loading?: boolean;
	};

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
