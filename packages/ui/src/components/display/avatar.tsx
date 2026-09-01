"use client";

import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";
import { cn } from "@workspace/ui/lib/utils";
import * as React from "react";

const Avatar = React.forwardRef<
	HTMLSpanElement,
	AvatarPrimitive.Root.Props & {
		size?: "default" | "sm" | "lg";
	}
>(function Avatar({ className, size = "default", ...props }, ref): React.JSX.Element {
	return (
		<AvatarPrimitive.Root
			ref={ref}
			data-slot="avatar"
			data-size={size}
			className={cn(
				"group/avatar relative flex size-8 shrink-0 rounded-full select-none after:absolute after:inset-0 after:rounded-full after:border after:border-border after:mix-blend-darken data-[size=lg]:size-10 data-[size=sm]:size-6 dark:after:mix-blend-lighten",
				className,
			)}
			{...props}
		/>
	);
});

const AvatarImage = React.forwardRef<HTMLImageElement, AvatarPrimitive.Image.Props>(function AvatarImage({ className, ...props }, ref): React.JSX.Element {
	return <AvatarPrimitive.Image ref={ref} data-slot="avatar-image" className={cn("aspect-square size-full rounded-full object-cover", className)} {...props} />;
});

const AvatarFallback = React.forwardRef<HTMLSpanElement, AvatarPrimitive.Fallback.Props>(function AvatarFallback({ className, ...props }, ref): React.JSX.Element {
	return (
		<AvatarPrimitive.Fallback
			ref={ref}
			data-slot="avatar-fallback"
			className={cn("flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground group-data-[size=sm]/avatar:text-xs", className)}
			{...props}
		/>
	);
});

const AvatarBadge = React.forwardRef<HTMLSpanElement, React.ComponentProps<"span">>(function AvatarBadge({ className, ...props }, ref): React.JSX.Element {
	return (
		<span
			ref={ref}
			data-slot="avatar-badge"
			className={cn(
				"absolute end-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground bg-blend-color ring-2 ring-background select-none",
				"group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden",
				"group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2",
				"group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2",
				className,
			)}
			{...props}
		/>
	);
});

const AvatarGroup = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function AvatarGroup({ className, ...props }, ref): React.JSX.Element {
	return (
		<div
			ref={ref}
			data-slot="avatar-group"
			className={cn("group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background", className)}
			{...props}
		/>
	);
});

const AvatarGroupCount = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function AvatarGroupCount({ className, ...props }, ref): React.JSX.Element {
	return (
		<div
			ref={ref}
			data-slot="avatar-group-count"
			className={cn(
				"relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground ring-2 ring-background group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 [&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3",
				className,
			)}
			{...props}
		/>
	);
});

export { Avatar, AvatarImage, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarBadge };
