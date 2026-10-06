import { cn } from "@workspace/ui/lib/core/utils";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

// Every part pads itself with `--card-spacing`, so `size` only sets that
// variable; `data-size` stays on the root for the title's `group-data-[size=sm]/card`.
const cardVariants = cva(
	"group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-lg bg-card py-(--card-spacing) text-sm text-card-foreground shadow-sm ring-1 inset-shadow-edge ring-foreground/10 has-[>img:first-child]:pt-0 *:[img:first-child]:rounded-t-lg *:[img:last-child]:rounded-b-lg",
	{
		variants: {
			size: {
				default: "[--card-spacing:--spacing(6)]",
				sm: "[--card-spacing:--spacing(4)]",
			},
		},
		defaultVariants: {
			size: "default",
		},
	},
);

type CardSize = NonNullable<VariantProps<typeof cardVariants>["size"]>;

type CardProps = React.ComponentProps<"div"> & { size?: CardSize };

const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card({ className, size = "default", ...props }, ref): React.JSX.Element {
	return <div ref={ref} data-slot="card" data-size={size} className={cn(cardVariants({ size }), className)} {...props} />;
});

const CardHeader = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function CardHeader({ className, ...props }, ref): React.JSX.Element {
	return (
		<div
			ref={ref}
			data-slot="card-header"
			className={cn(
				"group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-lg px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
				className,
			)}
			{...props}
		/>
	);
});

const CardTitle = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function CardTitle({ className, ...props }, ref): React.JSX.Element {
	return <div ref={ref} data-slot="card-title" className={cn("font-heading text-base leading-normal font-medium group-data-[size=sm]/card:text-sm", className)} {...props} />;
});

const CardDescription = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function CardDescription({ className, ...props }, ref): React.JSX.Element {
	return <div ref={ref} data-slot="card-description" className={cn("text-sm text-muted-foreground", className)} {...props} />;
});

const CardAction = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function CardAction({ className, ...props }, ref): React.JSX.Element {
	return <div ref={ref} data-slot="card-action" className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)} {...props} />;
});

const CardContent = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function CardContent({ className, ...props }, ref): React.JSX.Element {
	return <div ref={ref} data-slot="card-content" className={cn("px-(--card-spacing)", className)} {...props} />;
});

const CardFooter = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function CardFooter({ className, ...props }, ref): React.JSX.Element {
	return <div ref={ref} data-slot="card-footer" className={cn("flex items-center rounded-b-lg px-(--card-spacing) [.border-t]:pt-(--card-spacing)", className)} {...props} />;
});

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent, cardVariants, type CardProps, type CardSize };
