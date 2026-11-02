"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { resolveFieldState } from "@workspace/ui/lib/form/field-state";
import { switchVariants } from "@workspace/ui/lib/form/field-variants";
import { cn } from "@workspace/ui/lib/core/utils";
import type { VariantProps } from "class-variance-authority";
import { Check, Lock } from "lucide-react";
import * as React from "react";

/**
 * The thumb: full and light with a check while on, small and dark while off, faded while disabled.
 * It travels `--switch-thumb-travel` (`-sm` for the small size, RTL-aware) and shrinks around its centre while off.
 */
const switchThumbBaseClasses =
	"pointer-events-none flex items-center justify-center rounded-full ring-0 transition-[translate,scale,background-color] data-unchecked:translate-x-0 data-unchecked:scale-[0.7] rtl:data-unchecked:translate-x-0";
const switchThumbToneClasses =
	"data-checked:bg-primary-foreground data-checked:shadow-sm data-unchecked:bg-muted-foreground data-disabled:data-checked:bg-muted-foreground/60 data-disabled:data-checked:shadow-none data-disabled:data-unchecked:bg-muted-foreground/40";
/** A locked thumb is a light disc with a lock, on or off. */
const switchLockedThumbClasses = "bg-card shadow-sm";
type SwitchSize = "default" | "sm";
const SWITCH_THUMB_SIZE_CLASSES: Readonly<Record<SwitchSize, string>> = {
	default: "size-(--switch-thumb-size) data-checked:translate-x-(--switch-thumb-travel) rtl:data-checked:-translate-x-(--switch-thumb-travel)",
	sm: "size-(--switch-thumb-size-sm) data-checked:translate-x-(--switch-thumb-travel-sm) rtl:data-checked:-translate-x-(--switch-thumb-travel-sm)",
};
const SWITCH_GLYPH_SIZE_CLASSES: Readonly<Record<SwitchSize, string>> = { default: "size-2.5", sm: "size-2" };

type SwitchProps = SwitchPrimitive.Root.Props &
	VariantProps<typeof switchVariants> & {
		readonly loading?: boolean;
		/** Kept as it is by a policy ("Always on"): a lock in the thumb, and it never changes. */
		readonly locked?: boolean;
	};

const Switch = React.forwardRef<HTMLElement, SwitchProps>(function Switch(
	{ className, variant, size = "default", loading = false, locked = false, disabled, "aria-invalid": ariaInvalid, ...props },
	ref,
): React.JSX.Element {
	const inactive = disabled === true || locked;
	const state = resolveFieldState({ disabled: inactive, loading, ariaInvalid });
	const sizeKey: SwitchSize = size ?? "default";

	return (
		<SwitchPrimitive.Root
			ref={ref}
			data-slot="switch"
			data-size={size}
			disabled={inactive}
			aria-invalid={ariaInvalid}
			data-loading={loading ? "" : undefined}
			data-locked={locked ? "" : undefined}
			className={cn(switchVariants({ variant, size, state }), className)}
			{...props}>
			<SwitchPrimitive.Thumb
				data-slot="switch-thumb"
				className={cn(switchThumbBaseClasses, SWITCH_THUMB_SIZE_CLASSES[sizeKey], locked ? switchLockedThumbClasses : switchThumbToneClasses)}>
				{locked ? (
					<Lock data-slot="switch-lock" className={cn(SWITCH_GLYPH_SIZE_CLASSES[sizeKey], "text-primary")} strokeWidth={3} aria-hidden="true" />
				) : (
					<Check
						data-slot="switch-check"
						className={cn(SWITCH_GLYPH_SIZE_CLASSES[sizeKey], "hidden text-primary group-data-checked/switch:block group-data-disabled/switch:text-background")}
						strokeWidth={3}
						aria-hidden="true"
					/>
				)}
			</SwitchPrimitive.Thumb>
		</SwitchPrimitive.Root>
	);
});

export { Switch, switchVariants };
