"use client";

import { cn } from "@workspace/ui/lib/core/utils";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

/** `skeleton-bone` (styles/components.css) is the shared viewport-wide sweep; reduced motion leaves a still bone. */
const skeletonVariants = cva("skeleton-bone shrink-0 rounded-md bg-muted", {
	variants: {
		/** `default` (a block), `text` (a line) or `circular` (an avatar). */
		variant: {
			default: "",
			circular: "rounded-full",
			/** A line of text: rounded like a pill, sized by the caller's height. */
			text: "rounded-full",
		},
		/** A preset height: `sm` or `lg`. */
		size: {
			default: "",
			sm: "h-3",
			lg: "h-6",
		},
		/** The visual state; leave it unset. */
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

/** A muted placeholder that stands in for content while it loads. Size it to that content; the shimmer stays still under reduced motion. */
const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(function Skeleton({ className, variant, size, state, ...props }, ref): React.JSX.Element {
	return <div ref={ref} data-slot="skeleton" className={cn(skeletonVariants({ variant, size, state }), className)} {...props} />;
});

export { Skeleton, skeletonVariants };
