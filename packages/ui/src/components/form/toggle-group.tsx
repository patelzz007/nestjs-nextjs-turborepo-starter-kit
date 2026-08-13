"use client";

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import { toggleVariants } from "@workspace/ui/components/form/toggle";
import { cn } from "@workspace/ui/lib/utils";
import { type VariantProps } from "class-variance-authority";
import * as React from "react";

const ToggleGroupContext = React.createContext<
	VariantProps<typeof toggleVariants> & {
		spacing?: number;
		orientation?: "horizontal" | "vertical";
	}
>({
	size: "default",
	variant: "default",
	spacing: 2,
	orientation: "horizontal",
});

const ToggleGroup = React.forwardRef<
	HTMLDivElement,
	ToggleGroupPrimitive.Props &
		VariantProps<typeof toggleVariants> & {
			spacing?: number;
			orientation?: "horizontal" | "vertical";
		}
>(function ToggleGroup({ className, variant, size, spacing = 2, orientation = "horizontal", children, ...props }, ref): React.JSX.Element {
	const toggleGroupStyle: React.CSSProperties & Record<`--${string}`, number> = {
		"--gap": spacing,
	};

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
			<ToggleGroupContext.Provider value={{ variant, size, spacing, orientation }}>{children}</ToggleGroupContext.Provider>
		</ToggleGroupPrimitive>
	);
});

const ToggleGroupItem = React.forwardRef<HTMLButtonElement, TogglePrimitive.Props & VariantProps<typeof toggleVariants>>(function ToggleGroupItem(
	{ className, children, variant = "default", size = "default", ...props },
	ref,
): React.JSX.Element {
	const context = React.useContext(ToggleGroupContext);

	return (
		<TogglePrimitive
			ref={ref}
			data-slot="toggle-group-item"
			data-variant={context.variant ?? variant}
			data-size={context.size ?? size}
			data-spacing={context.spacing}
			className={cn(
				"shrink-0 group-data-[spacing=0]/toggle-group:rounded-none group-data-[spacing=0]/toggle-group:px-2 group-data-[spacing=0]/toggle-group:shadow-none focus:z-10 focus-visible:z-10 group-data-[spacing=0]/toggle-group:has-data-[icon=inline-end]:pe-1.5 group-data-[spacing=0]/toggle-group:has-data-[icon=inline-start]:ps-1.5 group-data-horizontal/toggle-group:data-[spacing=0]:first:rounded-s-md group-data-vertical/toggle-group:data-[spacing=0]:first:rounded-t-md group-data-horizontal/toggle-group:data-[spacing=0]:last:rounded-e-md group-data-vertical/toggle-group:data-[spacing=0]:last:rounded-b-md data-[state=on]:bg-muted group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:border-s-0 group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:border-t-0 group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-s group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-t",
				toggleVariants({
					variant: context.variant ?? variant,
					size: context.size ?? size,
				}),
				className,
			)}
			{...props}>
			{children}
		</TogglePrimitive>
	);
});

export { ToggleGroup, ToggleGroupItem };
