"use client";

import { cn } from "@workspace/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

const skeletonVariants = cva("animate-pulse rounded-md bg-muted", {
	variants: {
		variant: {
			default: "",
			circular: "rounded-full",
		},
		size: {
			default: "",
			sm: "h-3",
			lg: "h-6",
		},
		state: {
			default: "",
			loading: "",
			disabled: "opacity-50",
			error: "bg-destructive/10",
		},
	},
	defaultVariants: {
		variant: "default",
		size: "default",
		state: "default",
	},
});

type SkeletonProps = React.ComponentProps<"div"> & VariantProps<typeof skeletonVariants>;

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(function Skeleton({ className, variant, size, state, ...props }, ref): React.JSX.Element {
	return <div ref={ref} data-slot="skeleton" className={cn(skeletonVariants({ variant, size, state }), className)} {...props} />;
});

export { Skeleton, skeletonVariants };
