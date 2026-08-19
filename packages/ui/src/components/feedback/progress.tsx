"use client";

import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import { cn } from "@workspace/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

const progressVariants = cva("flex flex-wrap gap-3", {
	variants: {
		variant: {
			default: "",
		},
		size: {
			default: "",
			sm: "gap-2 text-xs",
			lg: "gap-4",
		},
		state: {
			default: "",
			loading: "opacity-60",
			disabled: "opacity-50",
			error: "[&_[data-slot=progress-indicator]]:bg-destructive",
		},
	},
	defaultVariants: {
		variant: "default",
		size: "default",
		state: "default",
	},
});

type ProgressProps = ProgressPrimitive.Root.Props & VariantProps<typeof progressVariants>;

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(function Progress({ className, children, value, variant, size, state, ...props }, ref): React.JSX.Element {
	return (
		<ProgressPrimitive.Root ref={ref} value={value} data-slot="progress" className={cn(progressVariants({ variant, size, state }), className)} {...props}>
			{children}
			<ProgressTrack>
				<ProgressIndicator />
			</ProgressTrack>
		</ProgressPrimitive.Root>
	);
});

const ProgressTrack = React.forwardRef<HTMLDivElement, ProgressPrimitive.Track.Props>(function ProgressTrack({ className, ...props }, ref): React.JSX.Element {
	return (
		<ProgressPrimitive.Track
			ref={ref}
			className={cn("relative flex h-1.5 w-full items-center overflow-x-hidden rounded-full bg-muted", className)}
			data-slot="progress-track"
			{...props}
		/>
	);
});

const ProgressIndicator = React.forwardRef<HTMLDivElement, ProgressPrimitive.Indicator.Props>(function ProgressIndicator({ className, ...props }, ref): React.JSX.Element {
	return <ProgressPrimitive.Indicator ref={ref} data-slot="progress-indicator" className={cn("h-full bg-primary transition-all", className)} {...props} />;
});

const ProgressLabel = React.forwardRef<HTMLSpanElement, ProgressPrimitive.Label.Props>(function ProgressLabel({ className, ...props }, ref): React.JSX.Element {
	return <ProgressPrimitive.Label ref={ref} className={cn("text-sm font-medium", className)} data-slot="progress-label" {...props} />;
});

const ProgressValue = React.forwardRef<HTMLSpanElement, ProgressPrimitive.Value.Props>(function ProgressValue({ className, ...props }, ref): React.JSX.Element {
	return <ProgressPrimitive.Value ref={ref} className={cn("ms-auto text-sm text-muted-foreground tabular-nums", className)} data-slot="progress-value" {...props} />;
});

export { Progress, ProgressTrack, ProgressIndicator, ProgressLabel, ProgressValue, progressVariants };
