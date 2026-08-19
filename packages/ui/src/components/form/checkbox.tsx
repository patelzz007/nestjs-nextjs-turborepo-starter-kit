"use client";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { resolveFieldState } from "@workspace/ui/lib/field-state";
import { checkboxVariants } from "@workspace/ui/lib/field-variants";
import { cn } from "@workspace/ui/lib/utils";
import { CheckIcon } from "lucide-react";
import type { VariantProps } from "class-variance-authority";
import * as React from "react";

type CheckboxProps = CheckboxPrimitive.Root.Props &
	VariantProps<typeof checkboxVariants> & {
		readonly loading?: boolean;
	};

const Checkbox = React.forwardRef<HTMLElement, CheckboxProps>(function Checkbox(
	{ className, variant, size, loading = false, disabled, "aria-invalid": ariaInvalid, ...props },
	ref,
): React.JSX.Element {
	const state = resolveFieldState({ disabled, loading, ariaInvalid });

	return (
		<CheckboxPrimitive.Root
			ref={ref}
			data-slot="checkbox"
			disabled={disabled}
			aria-invalid={ariaInvalid}
			data-loading={loading ? "" : undefined}
			className={cn(checkboxVariants({ variant, size, state }), className)}
			{...props}>
			<CheckboxPrimitive.Indicator data-slot="checkbox-indicator" className="grid place-content-center text-current transition-none [&>svg]:size-3.5">
				<CheckIcon />
			</CheckboxPrimitive.Indicator>
		</CheckboxPrimitive.Root>
	);
});

export { Checkbox, checkboxVariants };
