"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { resolveFieldState } from "@workspace/ui/lib/field-state";
import { switchVariants } from "@workspace/ui/lib/field-variants";
import { cn } from "@workspace/ui/lib/utils";
import type { VariantProps } from "class-variance-authority";
import * as React from "react";

type SwitchProps = SwitchPrimitive.Root.Props &
	VariantProps<typeof switchVariants> & {
		readonly loading?: boolean;
	};

const Switch = React.forwardRef<HTMLElement, SwitchProps>(function Switch(
	{ className, variant, size = "default", loading = false, disabled, "aria-invalid": ariaInvalid, ...props },
	ref,
): React.JSX.Element {
	const state = resolveFieldState({ disabled, loading, ariaInvalid });

	return (
		<SwitchPrimitive.Root
			ref={ref}
			data-slot="switch"
			data-size={size}
			disabled={disabled}
			aria-invalid={ariaInvalid}
			data-loading={loading ? "" : undefined}
			className={cn(switchVariants({ variant, size, state }), className)}
			{...props}>
			<SwitchPrimitive.Thumb
				data-slot="switch-thumb"
				className={cn(
					"pointer-events-none block rounded-full bg-background ring-0 transition-transform dark:data-checked:bg-primary-foreground dark:data-unchecked:bg-foreground",
					size === "sm"
						? "size-(--switch-thumb-size-sm) data-checked:translate-x-[calc(100%-2px)] rtl:data-checked:-translate-x-[calc(100%-2px)] data-unchecked:translate-x-0 rtl:data-unchecked:translate-x-0"
						: "size-(--switch-thumb-size) data-checked:translate-x-[calc(100%-2px)] rtl:data-checked:-translate-x-[calc(100%-2px)] data-unchecked:translate-x-0 rtl:data-unchecked:translate-x-0",
				)}
			/>
		</SwitchPrimitive.Root>
	);
});

export { Switch, switchVariants };
