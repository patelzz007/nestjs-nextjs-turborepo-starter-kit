"use client";

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import { toggleVariants } from "@workspace/ui/components/toggle";
import { cn } from "@workspace/ui/lib/core/utils";
import { resolveFieldState } from "@workspace/ui/lib/form/field-state";
import { type VariantProps } from "class-variance-authority";
import * as React from "react";

/** Default gap between items, in Tailwind spacing steps (`--spacing(2)` = 0.5rem). `0` renders a joined, segmented group. */
const DEFAULT_TOGGLE_GROUP_SPACING = 2;

type ToggleGroupOrientation = "horizontal" | "vertical";

type ToggleGroupContextValue = Omit<VariantProps<typeof toggleVariants>, "state"> & {
	readonly spacing?: number;
	readonly orientation?: ToggleGroupOrientation;
};

const DEFAULT_TOGGLE_GROUP_CONTEXT: ToggleGroupContextValue = {
	size: "default",
	variant: "default",
	spacing: DEFAULT_TOGGLE_GROUP_SPACING,
	orientation: "horizontal",
};

const ToggleGroupContext = React.createContext<ToggleGroupContextValue>(DEFAULT_TOGGLE_GROUP_CONTEXT);

/** CSS custom properties are kebab-case by spec, so the key is declared via `Record`. */
type ToggleGroupStyle = React.CSSProperties & Readonly<Record<"--gap", number>>;

type ToggleGroupProps = ToggleGroupPrimitive.Props &
	Omit<VariantProps<typeof toggleVariants>, "state"> & {
		readonly spacing?: number;
		readonly orientation?: ToggleGroupOrientation;
	};

const ToggleGroup = React.forwardRef<HTMLDivElement, ToggleGroupProps>(function ToggleGroup(
	{ className, variant, size, spacing = DEFAULT_TOGGLE_GROUP_SPACING, orientation = "horizontal", children, ...props },
	ref,
): React.JSX.Element {
	const toggleGroupStyle = React.useMemo<ToggleGroupStyle>(() => ({ "--gap": spacing }), [spacing]);
	const contextValue = React.useMemo<ToggleGroupContextValue>(() => ({ variant, size, spacing, orientation }), [variant, size, spacing, orientation]);

	return (
		<ToggleGroupPrimitive
			ref={ref}
			data-slot="toggle-group"
			data-variant={variant}
			data-size={size}
			data-spacing={spacing}
			data-orientation={orientation}
			style={toggleGroupStyle}
			className={cn(
				"group/toggle-group flex w-fit flex-row items-center gap-[--spacing(var(--gap))] rounded-md data-[spacing=0]:data-[variant=outline]:shadow-xs data-vertical:flex-col data-vertical:items-stretch",
				className,
			)}
			{...props}>
			<ToggleGroupContext.Provider value={contextValue}>{children}</ToggleGroupContext.Provider>
		</ToggleGroupPrimitive>
	);
});

type ToggleGroupItemProps = TogglePrimitive.Props &
	Omit<VariantProps<typeof toggleVariants>, "state"> & {
		/** Shows the busy treatment and blocks interaction while an async toggle settles. */
		readonly loading?: boolean;
	};

const ToggleGroupItem = React.forwardRef<HTMLButtonElement, ToggleGroupItemProps>(function ToggleGroupItem(
	{ className, children, variant = "default", size = "default", loading = false, disabled, "aria-invalid": ariaInvalid, ...props },
	ref,
): React.JSX.Element {
	const context = React.useContext(ToggleGroupContext);
	const state = resolveFieldState({ disabled, loading, ariaInvalid });

	return (
		<TogglePrimitive
			ref={ref}
			data-slot="toggle-group-item"
			data-variant={context.variant ?? variant}
			data-size={context.size ?? size}
			data-spacing={context.spacing}
			data-loading={loading ? "" : undefined}
			disabled={disabled === true || loading}
			aria-invalid={ariaInvalid}
			className={cn(
				"shrink-0 group-data-[spacing=0]/toggle-group:rounded-none group-data-[spacing=0]/toggle-group:px-2 group-data-[spacing=0]/toggle-group:shadow-none focus:z-10 focus-visible:z-10 group-data-[spacing=0]/toggle-group:has-data-[icon=inline-end]:pe-1.5 group-data-[spacing=0]/toggle-group:has-data-[icon=inline-start]:ps-1.5 group-data-horizontal/toggle-group:data-[spacing=0]:first:rounded-s-md group-data-vertical/toggle-group:data-[spacing=0]:first:rounded-t-md group-data-horizontal/toggle-group:data-[spacing=0]:last:rounded-e-md group-data-vertical/toggle-group:data-[spacing=0]:last:rounded-b-md data-[state=on]:bg-secondary data-[state=on]:text-secondary-foreground data-[state=on]:hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_6%)] data-[state=on]:hover:text-secondary-foreground group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:border-s-0 group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:border-t-0 group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-s group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-t",
				toggleVariants({
					variant: context.variant ?? variant,
					size: context.size ?? size,
					state,
				}),
				className,
			)}
			{...props}>
			{children}
		</TogglePrimitive>
	);
});

export { ToggleGroup, ToggleGroupItem };
export type { ToggleGroupItemProps, ToggleGroupProps };
