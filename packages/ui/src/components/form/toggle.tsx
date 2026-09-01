"use client";

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { cn } from "@workspace/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

const toggleVariants = cva(
	"group/toggle inline-flex items-center justify-center gap-1 rounded-md text-sm font-medium whitespace-nowrap text-foreground transition-[color,box-shadow,background-color] outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-pressed:bg-secondary aria-pressed:text-secondary-foreground aria-pressed:hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_6%)] aria-pressed:hover:text-secondary-foreground dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
	{
		variants: {
			variant: {
				default: "bg-transparent",
				outline: "border border-input bg-transparent shadow-xs hover:bg-muted hover:text-foreground",
			},
			size: {
				default: "h-10 min-w-10 px-3 has-data-[icon=inline-end]:pe-2.5 has-data-[icon=inline-start]:ps-2.5",
				sm: "h-9 min-w-9 px-2.5 has-data-[icon=inline-end]:pe-2 has-data-[icon=inline-start]:ps-2",
				lg: "h-11 min-w-11 px-3 has-data-[icon=inline-end]:pe-2.5 has-data-[icon=inline-start]:ps-2.5",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

const Toggle = React.forwardRef<HTMLButtonElement, TogglePrimitive.Props & VariantProps<typeof toggleVariants>>(function Toggle(
	{ className, variant = "default", size = "default", ...props },
	ref,
): React.JSX.Element {
	return <TogglePrimitive ref={ref} data-slot="toggle" className={cn(toggleVariants({ variant, size, className }))} {...props} />;
});

export { Toggle, toggleVariants };
