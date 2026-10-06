"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import type { BaseUIEvent } from "@base-ui/react/types";
import { useRender } from "@base-ui/react/use-render";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Separator } from "@workspace/ui/components/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@workspace/ui/components/sheet";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { sidebarMenuButtonVariants, sidebarMenuSubButtonVariants } from "@workspace/ui/lib/sidebar/variants";
import { cn } from "@workspace/ui/lib/core/utils";
import { type VariantProps } from "class-variance-authority";
import { PanelLeftIcon } from "lucide-react";
import * as React from "react";

import { useSidebar } from "./sidebar-context";

/** Skeleton text bar width (%) when none is given — mid-range, so every row looks alike. */
const DEFAULT_SKELETON_TEXT_WIDTH_PERCENT = 70;

export interface SidebarProps extends React.ComponentProps<"div"> {
	readonly side?: "left" | "right";
	readonly variant?: "sidebar" | "floating" | "inset";
	readonly collapsible?: "offcanvas" | "icon" | "none";
}

/**
 * The sidebar panel. The ref reaches the panel's root element in every mode:
 * the static `<div>` (`collapsible="none"`), the mobile sheet's popup, or the
 * desktop rail's outer `<div>`.
 */
export const Sidebar = React.forwardRef<HTMLDivElement, SidebarProps>(function Sidebar(
	{ side = "left", variant = "sidebar", collapsible = "offcanvas", className, children, dir, ...props },
	ref,
): React.JSX.Element {
	const { isMobile, state, openMobile, setOpenMobile, labels } = useSidebar();

	if (collapsible === "none") {
		return (
			<div ref={ref} data-slot="sidebar" className={cn("flex h-full w-(--sidebar-width) flex-col bg-sidebar text-sidebar-foreground", className)} {...props}>
				{children}
			</div>
		);
	}

	if (isMobile) {
		return (
			<Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
				<SheetContent
					ref={ref}
					dir={dir}
					data-sidebar="sidebar"
					data-slot="sidebar"
					data-mobile="true"
					className="w-(--sidebar-width-mobile) bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
					side={side}>
					<SheetHeader className="sr-only">
						<SheetTitle>{labels.mobileTitle}</SheetTitle>
						<SheetDescription>{labels.mobileDescription}</SheetDescription>
					</SheetHeader>
					<div className="flex h-full w-full flex-col">{children}</div>
				</SheetContent>
			</Sheet>
		);
	}

	return (
		<div
			ref={ref}
			className="group peer hidden text-sidebar-foreground lg:block"
			data-state={state}
			data-collapsible={state === "collapsed" ? collapsible : ""}
			data-variant={variant}
			data-side={side}
			data-slot="sidebar">
			{/* This is what handles the sidebar gap on desktop */}
			<div
				data-slot="sidebar-gap"
				className={cn(
					"relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear motion-reduce:transition-none",
					"group-data-[collapsible=offcanvas]:w-0",
					"group-data-[side=right]:rotate-180",
					variant === "floating" || variant === "inset"
						? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]"
						: "group-data-[collapsible=icon]:w-(--sidebar-width-icon)",
				)}
			/>
			<div
				data-slot="sidebar-container"
				data-side={side}
				className={cn(
					"fixed inset-y-0 z-sidebar hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-200 ease-linear data-[side=left]:left-0 data-[side=left]:group-data-[collapsible=offcanvas]:-left-(--sidebar-width) data-[side=right]:right-0 data-[side=right]:group-data-[collapsible=offcanvas]:-right-(--sidebar-width) motion-reduce:transition-none lg:flex",
					// Adjust the padding for floating and inset variants.
					variant === "floating" || variant === "inset"
						? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]"
						: "group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-e group-data-[side=right]:border-s",
					className,
				)}
				{...props}>
				<div
					data-sidebar="sidebar"
					data-slot="sidebar-inner"
					className="flex size-full flex-col bg-sidebar group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:shadow-sm group-data-[variant=floating]:ring-1 group-data-[variant=floating]:ring-sidebar-border">
					{children}
				</div>
			</div>
		</div>
	);
});

export const SidebarTrigger = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button>>(function SidebarTrigger(
	{ className, onClick, ...props },
	ref,
): React.JSX.Element {
	const { toggleSidebar, labels } = useSidebar();

	// Button is a base-ui wrapper — its onClick receives `BaseUIEvent`
	// (native event + preventBaseUIHandler), not a plain React.MouseEvent.
	const handleSidebarTriggerClick = React.useCallback(
		(event: BaseUIEvent<React.MouseEvent<HTMLButtonElement>>): void => {
			onClick?.(event);
			toggleSidebar();
		},
		[onClick, toggleSidebar],
	);

	return (
		<Button
			ref={ref}
			data-sidebar="trigger"
			data-slot="sidebar-trigger"
			variant="ghost"
			size="icon-sm"
			className={cn(className)}
			onClick={handleSidebarTriggerClick}
			{...props}>
			<PanelLeftIcon className="rtl:rotate-180" />
			<span className="sr-only">{labels.toggleSidebar}</span>
		</Button>
	);
});

export const SidebarRail = React.forwardRef<HTMLElement, React.ComponentProps<typeof Button>>(function SidebarRail({ className, ...props }, ref): React.JSX.Element {
	const { toggleSidebar, labels } = useSidebar();

	return (
		<Button
			ref={ref}
			type="button"
			variant="nav"
			data-sidebar="rail"
			data-slot="sidebar-rail"
			aria-label={labels.toggleSidebar}
			tabIndex={-1}
			onClick={toggleSidebar}
			title={labels.toggleSidebar}
			className={cn(
				"absolute inset-y-0 z-sidebar-rail hidden h-auto w-4 rounded-none border-0 bg-transparent p-0 shadow-none transition-all ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:inset-s-1/2 after:w-1 hover:bg-transparent hover:after:bg-sidebar-border sm:flex ltr:-translate-x-1/2 rtl:-translate-x-1/2",
				"in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize rtl:in-data-[side=left]:cursor-e-resize rtl:in-data-[side=right]:cursor-w-resize",
				"[[data-side=left][data-state=collapsed]_&]:cursor-e-resize rtl:[[data-side=left][data-state=collapsed]_&]:cursor-w-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize rtl:[[data-side=right][data-state=collapsed]_&]:cursor-e-resize",
				"group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:inset-s-full hover:group-data-[collapsible=offcanvas]:bg-sidebar rtl:group-data-[collapsible=offcanvas]:translate-x-0",
				"[[data-side=left][data-collapsible=offcanvas]_&]:-inset-e-2",
				"[[data-side=right][data-collapsible=offcanvas]_&]:-inset-s-2",
				className,
			)}
			{...props}
		/>
	);
});

export const SidebarInset = React.forwardRef<HTMLElement, React.ComponentProps<"main">>(function SidebarInset({ className, ...props }, ref): React.JSX.Element {
	return (
		<main
			ref={ref}
			data-slot="sidebar-inset"
			className={cn(
				"relative flex w-full flex-1 flex-col bg-background lg:peer-data-[variant=inset]:m-2 lg:peer-data-[variant=inset]:ms-0 lg:peer-data-[variant=inset]:rounded-xl lg:peer-data-[variant=inset]:shadow-sm lg:peer-data-[variant=inset]:peer-data-[state=collapsed]:ms-2",
				className,
			)}
			{...props}
		/>
	);
});

export const SidebarInput = React.forwardRef<HTMLInputElement, React.ComponentProps<typeof Input>>(function SidebarInput({ className, ...props }, ref): React.JSX.Element {
	return <Input ref={ref} data-slot="sidebar-input" data-sidebar="input" className={cn("h-8 w-full bg-background shadow-none", className)} {...props} />;
});

export const SidebarHeader = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function SidebarHeader({ className, ...props }, ref): React.JSX.Element {
	return <div ref={ref} data-slot="sidebar-header" data-sidebar="header" className={cn("flex flex-col gap-2 p-2", className)} {...props} />;
});

export const SidebarFooter = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function SidebarFooter({ className, ...props }, ref): React.JSX.Element {
	return <div ref={ref} data-slot="sidebar-footer" data-sidebar="footer" className={cn("flex shrink-0 flex-col gap-2 p-2", className)} {...props} />;
});

export const SidebarSeparator = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof Separator>>(function SidebarSeparator(
	{ className, ...props },
	ref,
): React.JSX.Element {
	return <Separator ref={ref} data-slot="sidebar-separator" data-sidebar="separator" className={cn("mx-2 w-auto bg-sidebar-border", className)} {...props} />;
});

export const SidebarContent = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function SidebarContent({ className, ...props }, ref): React.JSX.Element {
	return (
		<div
			ref={ref}
			data-slot="sidebar-content"
			data-sidebar="content"
			className={cn("no-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden", className)}
			{...props}
		/>
	);
});

export const SidebarGroup = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function SidebarGroup({ className, ...props }, ref): React.JSX.Element {
	return <div ref={ref} data-slot="sidebar-group" data-sidebar="group" className={cn("relative flex w-full min-w-0 flex-col p-2", className)} {...props} />;
});

export const SidebarGroupLabel = React.forwardRef<HTMLDivElement, useRender.ComponentProps<"div">>(function SidebarGroupLabel(
	{ className, render, ...props },
	ref,
): React.JSX.Element {
	return useRender({
		ref,
		defaultTagName: "div",
		props: mergeProps<"div">(
			{
				className: cn(
					"flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 ring-sidebar-ring outline-hidden transition-[margin,opacity] duration-200 ease-linear group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0 focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
					className,
				),
			},
			props,
		),
		render,
		state: {
			slot: "sidebar-group-label",
			sidebar: "group-label",
		},
	});
});

export const SidebarGroupAction = React.forwardRef<HTMLButtonElement, useRender.ComponentProps<"button">>(function SidebarGroupAction(
	{ className, render, ...props },
	ref,
): React.JSX.Element {
	return useRender({
		ref,
		defaultTagName: "button",
		props: mergeProps<"button">(
			{
				className: cn(
					"absolute end-3 top-3.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground ring-sidebar-ring outline-hidden transition-transform group-data-[collapsible=icon]:hidden after:absolute after:-inset-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 lg:after:hidden [&>svg]:size-4 [&>svg]:shrink-0",
					className,
				),
			},
			props,
		),
		render,
		state: {
			slot: "sidebar-group-action",
			sidebar: "group-action",
		},
	});
});

export const SidebarGroupContent = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function SidebarGroupContent(
	{ className, ...props },
	ref,
): React.JSX.Element {
	return <div ref={ref} data-slot="sidebar-group-content" data-sidebar="group-content" className={cn("w-full text-sm", className)} {...props} />;
});

export const SidebarMenu = React.forwardRef<HTMLUListElement, React.ComponentProps<"ul">>(function SidebarMenu({ className, ...props }, ref): React.JSX.Element {
	return <ul ref={ref} data-slot="sidebar-menu" data-sidebar="menu" className={cn("flex w-full min-w-0 flex-col gap-1", className)} {...props} />;
});

export const SidebarMenuItem = React.forwardRef<HTMLLIElement, React.ComponentProps<"li">>(function SidebarMenuItem({ className, ...props }, ref): React.JSX.Element {
	return <li ref={ref} data-slot="sidebar-menu-item" data-sidebar="menu-item" className={cn("group/menu-item relative", className)} {...props} />;
});

export type SidebarMenuButtonProps = useRender.ComponentProps<"button"> & {
	isActive?: boolean;
	tooltip?: React.ComponentProps<typeof TooltipContent>;
} & VariantProps<typeof sidebarMenuButtonVariants>;

export const SidebarMenuButton = React.forwardRef<HTMLButtonElement, SidebarMenuButtonProps>(function SidebarMenuButton(
	{ render, isActive = false, variant = "default", size = "default", tooltip, className, disabled, ...props },
	ref,
): React.JSX.Element {
	const { isMobile, state } = useSidebar();
	const menuState = isActive ? "active" : disabled === true ? "disabled" : "default";
	const comp = useRender({
		ref,
		defaultTagName: "button",
		props: mergeProps<"button">(
			{
				className: cn(sidebarMenuButtonVariants({ variant, size, state: menuState }), className),
				disabled,
			},
			props,
		),
		render: tooltip === undefined ? render : <TooltipTrigger render={render} />,
		state: {
			slot: "sidebar-menu-button",
			sidebar: "menu-button",
			size,
			active: isActive,
		},
	});

	if (tooltip === undefined) {
		return comp;
	}

	return (
		<Tooltip>
			{comp}
			<TooltipContent side="right" align="center" hidden={state !== "collapsed" || isMobile} {...tooltip} />
		</Tooltip>
	);
});

export type SidebarMenuActionProps = useRender.ComponentProps<"button"> & {
	showOnHover?: boolean;
};

export const SidebarMenuAction = React.forwardRef<HTMLButtonElement, SidebarMenuActionProps>(function SidebarMenuAction(
	{ className, render, showOnHover = false, ...props },
	ref,
): React.JSX.Element {
	return useRender({
		ref,
		defaultTagName: "button",
		props: mergeProps<"button">(
			{
				className: cn(
					"absolute end-1 top-1.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground ring-sidebar-ring outline-hidden transition-transform group-data-[collapsible=icon]:hidden peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[size=default]/menu-button:top-1.5 peer-data-[size=lg]/menu-button:top-2.5 peer-data-[size=sm]/menu-button:top-1 after:absolute after:-inset-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 lg:after:hidden [&>svg]:size-4 [&>svg]:shrink-0",
					showOnHover &&
						"group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 peer-data-active/menu-button:text-sidebar-primary-foreground aria-expanded:opacity-100 lg:opacity-0",
					className,
				),
			},
			props,
		),
		render,
		state: {
			slot: "sidebar-menu-action",
			sidebar: "menu-action",
		},
	});
});

export type SidebarMenuBadgeProps = React.ComponentProps<"div"> & {
	/** When set, reads the badge value from `SidebarProvider` `badges` map. */
	itemId?: string;
};

export const SidebarMenuBadge = React.forwardRef<HTMLDivElement, SidebarMenuBadgeProps>(function SidebarMenuBadge(
	{ className, itemId, children, ...props },
	ref,
): React.JSX.Element | null {
	const { badges } = useSidebar();
	const badgeFromContext = itemId !== undefined ? badges[itemId] : undefined;
	const content = children ?? (badgeFromContext !== undefined ? String(badgeFromContext) : null);
	if (content === null || content === "") {
		return null;
	}

	return (
		<div
			ref={ref}
			data-slot="sidebar-menu-badge"
			data-sidebar="menu-badge"
			className={cn(
				"pointer-events-none absolute inset-e-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium text-sidebar-foreground tabular-nums select-none group-data-[collapsible=icon]:hidden peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[size=default]/menu-button:top-1.5 peer-data-[size=lg]/menu-button:top-2.5 peer-data-[size=sm]/menu-button:top-1 peer-data-active/menu-button:text-sidebar-primary-foreground",
				className,
			)}
			{...props}>
			{content}
		</div>
	);
});

export type SidebarMenuSkeletonProps = React.ComponentProps<"div"> & {
	showIcon?: boolean;
	/** Deterministic skeleton bar width (50–90). Avoids hydration mismatch from random widths. */
	textWidthPercent?: number;
};

export const SidebarMenuSkeleton = React.forwardRef<HTMLDivElement, SidebarMenuSkeletonProps>(function SidebarMenuSkeleton(
	{ className, showIcon = false, textWidthPercent = DEFAULT_SKELETON_TEXT_WIDTH_PERCENT, ...props },
	ref,
): React.JSX.Element {
	const skeletonStyle = React.useMemo(
		(): React.CSSProperties & Record<`--${string}`, string> => ({
			"--skeleton-width": `${String(textWidthPercent)}%`,
		}),
		[textWidthPercent],
	);

	return (
		<div ref={ref} data-slot="sidebar-menu-skeleton" data-sidebar="menu-skeleton" className={cn("flex h-8 items-center gap-2 rounded-md px-2", className)} {...props}>
			{showIcon ? <Skeleton className="size-4 rounded-md" data-sidebar="menu-skeleton-icon" /> : null}
			<Skeleton className="h-4 max-w-(--skeleton-width) flex-1" data-sidebar="menu-skeleton-text" style={skeletonStyle} />
		</div>
	);
});

export const SidebarMenuSub = React.forwardRef<HTMLUListElement, React.ComponentProps<"ul">>(function SidebarMenuSub({ className, ...props }, ref): React.JSX.Element {
	return (
		<ul
			ref={ref}
			data-slot="sidebar-menu-sub"
			data-sidebar="menu-sub"
			className={cn(
				"mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-s border-sidebar-border px-2.5 py-0.5 group-data-[collapsible=icon]:hidden rtl:-translate-x-px",
				className,
			)}
			{...props}
		/>
	);
});

export const SidebarMenuSubItem = React.forwardRef<HTMLLIElement, React.ComponentProps<"li">>(function SidebarMenuSubItem({ className, ...props }, ref): React.JSX.Element {
	return <li ref={ref} data-slot="sidebar-menu-sub-item" data-sidebar="menu-sub-item" className={cn("group/menu-sub-item relative", className)} {...props} />;
});

export type SidebarMenuSubButtonProps = useRender.ComponentProps<"a"> & {
	size?: "sm" | "md";
	isActive?: boolean;
};

export const SidebarMenuSubButton = React.forwardRef<HTMLAnchorElement, SidebarMenuSubButtonProps>(function SidebarMenuSubButton(
	{ render, size = "md", isActive = false, className, "aria-disabled": ariaDisabled, ...props },
	ref,
): React.JSX.Element {
	const isDisabled = ariaDisabled === true;
	const menuState = isActive ? "active" : isDisabled ? "disabled" : "default";
	return useRender({
		ref,
		defaultTagName: "a",
		props: mergeProps<"a">(
			{
				className: cn(sidebarMenuSubButtonVariants({ size, state: menuState }), className),
				"aria-disabled": ariaDisabled,
			},
			props,
		),
		render,
		state: {
			slot: "sidebar-menu-sub-button",
			sidebar: "menu-sub-button",
			size,
			active: isActive,
		},
	});
});
