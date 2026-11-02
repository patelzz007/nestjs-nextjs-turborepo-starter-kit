"use client";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { resolveFieldState } from "@workspace/ui/lib/form/field-state";
import { checkboxVariants } from "@workspace/ui/lib/form/field-variants";
import { cn } from "@workspace/ui/lib/core/utils";
import { CheckIcon, Lock, MinusIcon } from "lucide-react";
import type { VariantProps } from "class-variance-authority";
import * as React from "react";

type CheckboxProps = CheckboxPrimitive.Root.Props &
	VariantProps<typeof checkboxVariants> & {
		readonly loading?: boolean;
		/** Kept as it is by a policy ("Always on"): a tinted box with a lock, and it never changes. */
		readonly locked?: boolean;
	};

/** A box that is checked (a tick), part-checked (`indeterminate`, a dash), unchecked, or locked (a lock). */
const Checkbox = React.forwardRef<HTMLElement, CheckboxProps>(function Checkbox(
	{ className, variant, size, loading = false, locked = false, disabled, "aria-invalid": ariaInvalid, ...props },
	ref,
): React.JSX.Element {
	const state = resolveFieldState({ disabled, loading, ariaInvalid });

	return (
		<CheckboxPrimitive.Root
			ref={ref}
			data-slot="checkbox"
			disabled={disabled === true || locked}
			aria-invalid={ariaInvalid}
			data-loading={loading ? "" : undefined}
			data-locked={locked ? "" : undefined}
			className={cn(checkboxVariants({ variant, size, state }), className)}
			{...props}>
			<CheckboxPrimitive.Indicator data-slot="checkbox-indicator" className="grid place-content-center text-current transition-none [&>svg]:size-3.5">
				{locked ? (
					<Lock data-slot="checkbox-lock" strokeWidth={3} aria-hidden="true" />
				) : (
					<>
						<CheckIcon data-slot="checkbox-check" className="in-data-indeterminate:hidden" aria-hidden="true" />
						<MinusIcon data-slot="checkbox-dash" className="hidden in-data-indeterminate:block" strokeWidth={3} aria-hidden="true" />
					</>
				)}
			</CheckboxPrimitive.Indicator>
		</CheckboxPrimitive.Root>
	);
});

export { Checkbox, checkboxVariants };
