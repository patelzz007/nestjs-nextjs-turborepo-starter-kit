"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { Button } from "@workspace/ui/components/form/button";
import { Input } from "@workspace/ui/components/form/input";
import { Separator } from "@workspace/ui/components/display/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@workspace/ui/components/overlay/sheet";
import { Skeleton } from "@workspace/ui/components/feedback/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/overlay/tooltip";
import { isMobileViewport, MOBILE_MEDIA_QUERY, useIsMobile } from "@workspace/ui/hooks/use-mobile";
import { type SidebarLabels } from "@workspace/ui/lib/sidebar-labels";
import { createCookieSidebarStorage, type SidebarStorageAdapter } from "@workspace/ui/lib/sidebar-storage";
import { sidebarMenuButtonVariants, sidebarMenuSubButtonVariants } from "@workspace/ui/lib/sidebar-variants";
import { cn } from "@workspace/ui/lib/utils";
import { type VariantProps } from "class-variance-authority";
import { PanelLeftIcon } from "lucide-react";
import * as React from "react";

const SIDEBAR_KEYBOARD_SHORTCUT = "b";

interface SidebarContextProps {
	state: "expanded" | "collapsed";
	open: boolean;
	setOpen: (open: boolean) => void;
	openMobile: boolean;
	setOpenMobile: (open: boolean) => void;
	isMobile: boolean;
	toggleSidebar: () => void;
	labels: SidebarLabels;
	/** Notification counts keyed by menu item id — consumed by `SidebarMenuBadge`. */
	badges: Readonly<Record<string, string | number>>;
}

const SidebarContext = React.createContext<SidebarContextProps | null>(null);

function useSidebar(): SidebarContextProps {
	const context = React.useContext(SidebarContext);
	if (!context) {
		throw new Error("useSidebar must be used within a SidebarProvider.");
	}

	return context;
}

const SidebarProvider = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<"div"> & {
		defaultOpen?: boolean;
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		labels: SidebarLabels;
		storage?: SidebarStorageAdapter;
		keyboardShortcut?: string;
		badges?: Readonly<Record<string, string | number>>;
	}
>(function SidebarProvider(
	{
		defaultOpen = true,
		open: openProp,
		onOpenChange: setOpenProp,
		className,
		style,
		children,
		labels,
		storage,
		keyboardShortcut = SIDEBAR_KEYBOARD_SHORTCUT,
		badges = {},
		...props
	},
	ref,
): React.JSX.Element {
	const isMobile = useIsMobile();
	const [openMobile, setOpenMobile] = React.useState(false);
	const resolvedStorage = React.useMemo(() => storage ?? createCookieSidebarStorage(), [storage]);
	const isStorageBacked = openProp === undefined && setOpenProp === undefined;

	const [openState, setOpenState] = React.useState((): boolean => {
		if (!isStorageBacked) {
			return defaultOpen;
		}
		return resolvedStorage.read() ?? defaultOpen;
	});
	const open = openProp ?? openState;

	const setOpen = React.useCallback(
		(nextOpen: boolean): void => {
			if (setOpenProp) {
				setOpenProp(nextOpen);
			} else {
				setOpenState(nextOpen);
			}
			if (isStorageBacked) {
				resolvedStorage.write(nextOpen);
			}
		},
		[setOpenProp, resolvedStorage, isStorageBacked],
	);

	const toggleSidebar = React.useCallback((): void => {
		if (isMobileViewport()) {
			setOpenMobile((current) => !current);
		} else {
			setOpen(!open);
		}
	}, [open, setOpen]);

	React.useEffect((): (() => void) => {
		const mediaQueryList = window.matchMedia(MOBILE_MEDIA_QUERY);
		const handleViewportChange = (): void => {
			if (!mediaQueryList.matches) {
				setOpenMobile(false);
			}
		};
		handleViewportChange();
		mediaQueryList.addEventListener("change", handleViewportChange);
		return (): void => {
			mediaQueryList.removeEventListener("change", handleViewportChange);
		};
	}, []);

	React.useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent): void => {
			if (event.key === keyboardShortcut && (event.metaKey || event.ctrlKey)) {
				event.preventDefault();
				toggleSidebar();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return (): void => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [toggleSidebar, keyboardShortcut]);

	const state = open ? "expanded" : "collapsed";

	const contextValue = React.useMemo<SidebarContextProps>(
		() => ({
			state,
			open,
			setOpen,
			isMobile,
			openMobile,
			setOpenMobile,
			toggleSidebar,
			labels,
			badges,
		}),
		[state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar, labels, badges],
	);

	return (
		<SidebarContext.Provider value={contextValue}>
			<div
				ref={ref}
				data-slot="sidebar-wrapper"
				style={style}
				className={cn("group/sidebar-wrapper flex min-h-svh w-full has-data-[variant=inset]:bg-sidebar", className)}
				{...props}>
				{children}
			</div>
		</SidebarContext.Provider>
	);
});

function Sidebar({
	side = "left",
	variant = "sidebar",
	collapsible = "offcanvas",
	className,
	children,
	dir,
	...props
}: React.ComponentProps<"div"> & {
	side?: "left" | "right";
	variant?: "sidebar" | "floating" | "inset";
	collapsible?: "offcanvas" | "icon" | "none";
}): React.JSX.Element {
	const { isMobile, state, openMobile, setOpenMobile, labels } = useSidebar();

	if (collapsible === "none") {
		return (
			<div data-slot="sidebar" className={cn("flex h-full w-(--sidebar-width) flex-col bg-sidebar text-sidebar-foreground", className)} {...props}>
				{children}
			</div>
		);
	}

	if (isMobile) {
		return (
			<Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
				<SheetContent
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
					"z-sidebar fixed inset-y-0 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-200 ease-linear data-[side=left]:left-0 data-[side=left]:group-data-[collapsible=offcanvas]:-left-(--sidebar-width) data-[side=right]:right-0 data-[side=right]:group-data-[collapsible=offcanvas]:-right-(--sidebar-width) motion-reduce:transition-none lg:flex",
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
}

const SidebarTrigger = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button>>(function SidebarTrigger(
	{ className, onClick, ...props },
	ref,
): React.JSX.Element {
	const { toggleSidebar, labels } = useSidebar();

	const handleSidebarTriggerClick = React.useCallback(
		(event: Parameters<NonNullable<React.ComponentProps<typeof Button>["onClick"]>>[0]): void => {
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

const SidebarRail = React.forwardRef<HTMLElement, React.ComponentProps<typeof Button>>(function SidebarRail({ className, ...props }, ref): React.JSX.Element {
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
				"z-sidebar-rail absolute inset-y-0 hidden h-auto w-4 rounded-none border-0 bg-transparent p-0 shadow-none transition-all ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:inset-s-1/2 after:w-1 hover:bg-transparent hover:after:bg-sidebar-border sm:flex ltr:-translate-x-1/2 rtl:-translate-x-1/2",
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

const SidebarInset = React.forwardRef<HTMLElement, React.ComponentProps<"main">>(function SidebarInset({ className, ...props }, ref): React.JSX.Element {
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

function SidebarInput({ className, ...props }: React.ComponentProps<typeof Input>): React.JSX.Element {
	return <Input data-slot="sidebar-input" data-sidebar="input" className={cn("h-8 w-full bg-background shadow-none", className)} {...props} />;
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">): React.JSX.Element {
	return <div data-slot="sidebar-header" data-sidebar="header" className={cn("flex flex-col gap-2 p-2", className)} {...props} />;
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">): React.JSX.Element {
	return <div data-slot="sidebar-footer" data-sidebar="footer" className={cn("flex flex-col gap-2 p-2", className)} {...props} />;
}

function SidebarSeparator({ className, ...props }: React.ComponentProps<typeof Separator>): React.JSX.Element {
	return <Separator data-slot="sidebar-separator" data-sidebar="separator" className={cn("mx-2 w-auto bg-sidebar-border", className)} {...props} />;
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">): React.JSX.Element {
	return (
		<div
			data-slot="sidebar-content"
			data-sidebar="content"
			className={cn("no-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden", className)}
			{...props}
		/>
	);
}

function SidebarGroup({ className, ...props }: React.ComponentProps<"div">): React.JSX.Element {
	return <div data-slot="sidebar-group" data-sidebar="group" className={cn("relative flex w-full min-w-0 flex-col p-2", className)} {...props} />;
}

function SidebarGroupLabel({ className, render, ...props }: useRender.ComponentProps<"div"> & React.ComponentProps<"div">): React.JSX.Element {
	return useRender({
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
}

function SidebarGroupAction({ className, render, ...props }: useRender.ComponentProps<"button"> & React.ComponentProps<"button">): React.JSX.Element {
	return useRender({
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
}

function SidebarGroupContent({ className, ...props }: React.ComponentProps<"div">): React.JSX.Element {
	return <div data-slot="sidebar-group-content" data-sidebar="group-content" className={cn("w-full text-sm", className)} {...props} />;
}

function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">): React.JSX.Element {
	return <ul data-slot="sidebar-menu" data-sidebar="menu" className={cn("flex w-full min-w-0 flex-col gap-1", className)} {...props} />;
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">): React.JSX.Element {
	return <li data-slot="sidebar-menu-item" data-sidebar="menu-item" className={cn("group/menu-item relative", className)} {...props} />;
}

function SidebarMenuButton({
	render,
	isActive = false,
	variant = "default",
	size = "default",
	tooltip,
	className,
	disabled,
	...props
}: useRender.ComponentProps<"button"> &
	React.ComponentProps<"button"> & {
		isActive?: boolean;
		tooltip?: React.ComponentProps<typeof TooltipContent>;
	} & VariantProps<typeof sidebarMenuButtonVariants>): React.JSX.Element {
	const { isMobile, state } = useSidebar();
	const menuState = isActive ? "active" : disabled === true ? "disabled" : "default";
	const comp = useRender({
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
}

function SidebarMenuAction({
	className,
	render,
	showOnHover = false,
	...props
}: useRender.ComponentProps<"button"> &
	React.ComponentProps<"button"> & {
		showOnHover?: boolean;
	}): React.JSX.Element {
	return useRender({
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
}

function SidebarMenuBadge({
	className,
	itemId,
	children,
	...props
}: React.ComponentProps<"div"> & {
	/** When set, reads the badge value from `SidebarProvider` `badges` map. */
	itemId?: string;
}): React.JSX.Element | null {
	const { badges } = useSidebar();
	const badgeFromContext = itemId !== undefined ? badges[itemId] : undefined;
	const content = children ?? (badgeFromContext !== undefined ? String(badgeFromContext) : null);
	if (content === null || content === "") {
		return null;
	}

	return (
		<div
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
}

function SidebarMenuSkeleton({
	className,
	showIcon = false,
	textWidthPercent = 70,
	...props
}: React.ComponentProps<"div"> & {
	showIcon?: boolean;
	/** Deterministic skeleton bar width (50–90). Avoids hydration mismatch from random widths. */
	textWidthPercent?: number;
}): React.JSX.Element {
	const skeletonStyle: React.CSSProperties & Record<`--${string}`, string> = {
		"--skeleton-width": `${String(textWidthPercent)}%`,
	};

	return (
		<div data-slot="sidebar-menu-skeleton" data-sidebar="menu-skeleton" className={cn("flex h-8 items-center gap-2 rounded-md px-2", className)} {...props}>
			{showIcon ? <Skeleton className="size-4 rounded-md" data-sidebar="menu-skeleton-icon" /> : null}
			<Skeleton className="h-4 max-w-(--skeleton-width) flex-1" data-sidebar="menu-skeleton-text" style={skeletonStyle} />
		</div>
	);
}

function SidebarMenuSub({ className, ...props }: React.ComponentProps<"ul">): React.JSX.Element {
	return (
		<ul
			data-slot="sidebar-menu-sub"
			data-sidebar="menu-sub"
			className={cn(
				"mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-s border-sidebar-border px-2.5 py-0.5 group-data-[collapsible=icon]:hidden rtl:-translate-x-px",
				className,
			)}
			{...props}
		/>
	);
}

function SidebarMenuSubItem({ className, ...props }: React.ComponentProps<"li">): React.JSX.Element {
	return <li data-slot="sidebar-menu-sub-item" data-sidebar="menu-sub-item" className={cn("group/menu-sub-item relative", className)} {...props} />;
}

function SidebarMenuSubButton({
	render,
	size = "md",
	isActive = false,
	className,
	"aria-disabled": ariaDisabled,
	...props
}: useRender.ComponentProps<"a"> &
	React.ComponentProps<"a"> & {
		size?: "sm" | "md";
		isActive?: boolean;
	}): React.JSX.Element {
	const isDisabled = ariaDisabled === true;
	const menuState = isActive ? "active" : isDisabled ? "disabled" : "default";
	return useRender({
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
}

export {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupAction,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInput,
	SidebarInset,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSkeleton,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	SidebarProvider,
	SidebarRail,
	SidebarSeparator,
	SidebarTrigger,
	useSidebar,
};
export type { SidebarLabels } from "@workspace/ui/lib/sidebar-labels";
export { createCookieSidebarStorage, createNoopSidebarStorage, type SidebarStorageAdapter } from "@workspace/ui/lib/sidebar-storage";
export { sidebarMenuButtonVariants, sidebarMenuSubButtonVariants } from "@workspace/ui/lib/sidebar-variants";
