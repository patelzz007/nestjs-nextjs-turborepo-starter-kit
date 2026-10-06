// Ported from ReUI (https://reui.io/r/base-vega/alert.json). Parts, variants
// and `data-slot` attributes match ReUI, so its docs and examples apply, with
// these deliberate deviations:
// - Every part forwards its ref.
// - A `size` variant (`sm` | `default`) for compact banners.
// - `role` defaults to `alert` but is a normal prop: pass `status` for a polite,
//   non-interrupting message, or `none` when an ancestor is the live region.
//
// Stateless by design: showing, hiding and dismissing an alert is the parent's
// job (render it conditionally; put a dismiss `Button` in `AlertAction`).
import { cn } from "@workspace/ui/lib/core/utils";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

const alertVariants = cva(
	[
		"relative grid w-full grid-cols-[0_1fr] items-center gap-y-0.5 rounded-lg border text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*3)_1fr] has-[>svg]:gap-x-2.5 [&>svg:not([class*=size-])]:size-4",
		"has-[>[data-slot=alert-title]+[data-slot=alert-description]]:[&_[data-slot=alert-action]]:sm:row-end-3",
		"has-[>[data-slot=alert-title]+[data-slot=alert-description]]:items-start",
		"has-[>[data-slot=alert-title]+[data-slot=alert-description]]:[&_svg]:translate-y-0.5",
	],
	{
		variants: {
			variant: {
				default: "bg-card text-card-foreground",
				destructive: "border-destructive/30 bg-destructive/4 [&>svg]:text-destructive",
				info: "border-info/30 bg-info/4 [&>svg]:text-info",
				success: "border-success/30 bg-success/4 [&>svg]:text-success",
				warning: "border-warning/30 bg-warning/4 [&>svg]:text-warning",
				invert: "border-invert bg-invert text-invert-foreground [&_[data-slot=alert-description]]:text-invert-foreground/70",
			},
			size: {
				sm: "px-3 py-2 text-xs",
				default: "px-3 py-2.5",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

type AlertVariant = NonNullable<VariantProps<typeof alertVariants>["variant"]>;

interface AlertProps extends React.ComponentProps<"div">, VariantProps<typeof alertVariants> {}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(function Alert({ className, variant, size, role = "alert", ...props }, ref): React.JSX.Element {
	return <div ref={ref} data-slot="alert" data-variant={variant ?? "default"} role={role} className={cn(alertVariants({ variant, size }), className)} {...props} />;
});

const AlertTitle = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function AlertTitle({ className, ...props }, ref): React.JSX.Element {
	return <div ref={ref} data-slot="alert-title" className={cn("col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight", className)} {...props} />;
});

const AlertDescription = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function AlertDescription({ className, ...props }, ref): React.JSX.Element {
	return (
		<div
			ref={ref}
			data-slot="alert-description"
			className={cn("col-start-2 grid justify-items-start gap-1 text-sm text-muted-foreground [&_p]:leading-relaxed", className)}
			{...props}
		/>
	);
});

const AlertAction = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function AlertAction({ className, ...props }, ref): React.JSX.Element {
	return (
		<div
			ref={ref}
			data-slot="alert-action"
			className={cn("flex gap-1.5 max-sm:col-start-2 max-sm:mt-2 max-sm:justify-start sm:col-start-3 sm:row-start-1 sm:justify-end sm:self-center", className)}
			{...props}
		/>
	);
});

export { Alert, AlertTitle, AlertDescription, AlertAction, alertVariants, type AlertProps, type AlertVariant };
