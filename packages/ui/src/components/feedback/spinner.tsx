import { cn } from "@workspace/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2Icon } from "lucide-react";
import * as React from "react";

const spinnerVariants = cva("animate-spin", {
	variants: {
		variant: {
			default: "text-current",
			muted: "text-muted-foreground",
			primary: "text-primary",
		},
		size: {
			default: "size-4",
			sm: "size-3",
			lg: "size-6",
		},
		state: {
			default: "",
			loading: "",
			disabled: "opacity-50",
			error: "text-destructive",
		},
	},
	defaultVariants: {
		variant: "default",
		size: "default",
		state: "default",
	},
});

type SpinnerProps = Omit<React.ComponentProps<"svg">, "children" | "aria-label"> &
	VariantProps<typeof spinnerVariants> & {
		/** Required unless `aria-hidden` is set (e.g. decorative spinner inside a labeled button). */
		readonly ariaLabel?: string;
	};

const Spinner = React.forwardRef<SVGSVGElement, SpinnerProps>(function Spinner(
	{ className, variant, size, state, ariaLabel, "aria-hidden": ariaHidden, ...props },
	ref,
): React.JSX.Element {
	return (
		<Loader2Icon
			ref={ref}
			data-slot="spinner"
			role={ariaHidden ? undefined : "status"}
			aria-label={ariaHidden ? undefined : ariaLabel}
			aria-hidden={ariaHidden}
			className={cn(spinnerVariants({ variant, size, state }), className)}
			{...props}
		/>
	);
});

export { Spinner, spinnerVariants };
