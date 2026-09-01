import { cn } from "@workspace/ui/lib/utils";
import * as React from "react";

const Card = React.forwardRef<HTMLDivElement, React.ComponentProps<"div"> & { size?: "default" | "sm" }>(function Card(
	{ className, size = "default", ...props },
	ref,
): React.JSX.Element {
	return (
		<div
			ref={ref}
			data-slot="card"
			data-size={size}
			className={cn(
				"group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl bg-card py-(--card-spacing) text-sm text-card-foreground shadow-xs ring-1 ring-foreground/10 [--card-spacing:--spacing(6)] has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(4)] *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
				className,
			)}
			{...props}
		/>
	);
});

const CardHeader = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function CardHeader({ className, ...props }, ref): React.JSX.Element {
	return (
		<div
			ref={ref}
			data-slot="card-header"
			className={cn(
				"group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
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
	return <div ref={ref} data-slot="card-footer" className={cn("flex items-center rounded-b-xl px-(--card-spacing) [.border-t]:pt-(--card-spacing)", className)} {...props} />;
});

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent };
