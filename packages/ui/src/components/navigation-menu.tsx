"use client";

import { NavigationMenu as NavigationMenuPrimitive } from "@base-ui/react/navigation-menu";
import { cn } from "@workspace/ui/lib/core/utils";
import { cva } from "class-variance-authority";
import { ChevronDownIcon } from "lucide-react";
import * as React from "react";

/** Gap (px) between the menu bar and the floating popup. */
const NAVIGATION_MENU_SIDE_OFFSET = 8;

// Every part renders DOM (the root is a `<nav>`, or a `<div>` when nested), so
// every part forwards its ref.
const NavigationMenu = React.forwardRef<HTMLElement, NavigationMenuPrimitive.Root.Props & Pick<NavigationMenuPrimitive.Positioner.Props, "align">>(function NavigationMenu(
	{ align = "start", className, children, ...props },
	ref,
): React.JSX.Element {
	return (
		<NavigationMenuPrimitive.Root
			ref={ref}
			data-slot="navigation-menu"
			className={cn("group/navigation-menu relative flex max-w-max flex-1 items-center justify-center", className)}
			{...props}>
			{children}
			<NavigationMenuPositioner align={align} />
		</NavigationMenuPrimitive.Root>
	);
});

const NavigationMenuList = React.forwardRef<HTMLUListElement, NavigationMenuPrimitive.List.Props>(function NavigationMenuList(
	{ className, ...props },
	ref,
): React.JSX.Element {
	return (
		<NavigationMenuPrimitive.List
			ref={ref}
			data-slot="navigation-menu-list"
			className={cn("group flex flex-1 list-none items-center justify-center gap-0", className)}
			{...props}
		/>
	);
});

const NavigationMenuItem = React.forwardRef<HTMLLIElement, NavigationMenuPrimitive.Item.Props>(function NavigationMenuItem({ className, ...props }, ref): React.JSX.Element {
	return <NavigationMenuPrimitive.Item ref={ref} data-slot="navigation-menu-item" className={cn("relative", className)} {...props} />;
});

const navigationMenuTriggerStyle = cva(
	"group/navigation-menu-trigger inline-flex h-9 w-max items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-all outline-none hover:bg-muted focus:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 data-popup-open:bg-muted/50 data-popup-open:hover:bg-muted data-open:bg-muted/50 data-open:hover:bg-muted data-open:focus:bg-muted",
);

const NavigationMenuTrigger = React.forwardRef<HTMLButtonElement, NavigationMenuPrimitive.Trigger.Props>(function NavigationMenuTrigger(
	{ className, children, ...props },
	ref,
): React.JSX.Element {
	return (
		<NavigationMenuPrimitive.Trigger ref={ref} data-slot="navigation-menu-trigger" className={cn(navigationMenuTriggerStyle(), "group", className)} {...props}>
			{children}{" "}
			<ChevronDownIcon
				className="relative top-px ms-1 size-3 transition duration-300 group-data-popup-open/navigation-menu-trigger:rotate-180 group-data-open/navigation-menu-trigger:rotate-180"
				aria-hidden="true"
			/>
		</NavigationMenuPrimitive.Trigger>
	);
});

const NavigationMenuContent = React.forwardRef<HTMLDivElement, NavigationMenuPrimitive.Content.Props>(function NavigationMenuContent(
	{ className, ...props },
	ref,
): React.JSX.Element {
	return (
		<NavigationMenuPrimitive.Content
			ref={ref}
			data-slot="navigation-menu-content"
			className={cn(
				"data-ending-style:data-activation-direction=left:translate-x-[50%] rtl:data-ending-style:data-activation-direction=left:-translate-x-[50%] data-ending-style:data-activation-direction=right:translate-x-[-50%] rtl:data-ending-style:data-activation-direction=right:-translate-x-[-50%] data-starting-style:data-activation-direction=left:translate-x-[-50%] rtl:data-starting-style:data-activation-direction=left:-translate-x-[-50%] data-starting-style:data-activation-direction=right:translate-x-[50%] rtl:data-starting-style:data-activation-direction=right:-translate-x-[50%] h-full w-auto p-2 pe-2.5 transition-[opacity,transform,translate] duration-350 ease-(--ease-overlay-emphasized) group-data-[viewport=false]/navigation-menu:rounded-md group-data-[viewport=false]/navigation-menu:bg-popover group-data-[viewport=false]/navigation-menu:text-popover-foreground group-data-[viewport=false]/navigation-menu:shadow group-data-[viewport=false]/navigation-menu:ring-1 group-data-[viewport=false]/navigation-menu:ring-foreground/10 group-data-[viewport=false]/navigation-menu:duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0 data-[motion=from-end]:slide-in-from-right-52 data-[motion=from-start]:slide-in-from-left-52 data-[motion=to-end]:slide-out-to-right-52 data-[motion=to-start]:slide-out-to-left-52 data-[motion^=from-]:animate-in data-[motion^=from-]:fade-in data-[motion^=to-]:animate-out data-[motion^=to-]:fade-out **:data-[slot=navigation-menu-link]:focus:ring-0 **:data-[slot=navigation-menu-link]:focus:outline-none group-data-[viewport=false]/navigation-menu:data-open:animate-in group-data-[viewport=false]/navigation-menu:data-open:fade-in-0 group-data-[viewport=false]/navigation-menu:data-open:zoom-in-95 group-data-[viewport=false]/navigation-menu:data-closed:animate-out group-data-[viewport=false]/navigation-menu:data-closed:fade-out-0 group-data-[viewport=false]/navigation-menu:data-closed:zoom-out-95",
				className,
			)}
			{...props}
		/>
	);
});

const NavigationMenuPositioner = React.forwardRef<HTMLDivElement, NavigationMenuPrimitive.Positioner.Props>(function NavigationMenuPositioner(
	{ className, side = "bottom", sideOffset = NAVIGATION_MENU_SIDE_OFFSET, align = "start", alignOffset = 0, ...props },
	ref,
): React.JSX.Element {
	return (
		<NavigationMenuPrimitive.Portal>
			<NavigationMenuPrimitive.Positioner
				ref={ref}
				side={side}
				sideOffset={sideOffset}
				align={align}
				alignOffset={alignOffset}
				className={cn(
					"isolate z-popover h-(--positioner-height) w-(--positioner-width) max-w-(--available-width) transition-[top,left,right,bottom] duration-350 ease-(--ease-overlay-emphasized) data-instant:transition-none data-[side=bottom]:before:inset-s-0 data-[side=bottom]:before:inset-e-0 data-[side=bottom]:before:-top-2.5",
					className,
				)}
				{...props}>
				<NavigationMenuPrimitive.Popup className="data-[ending-style]:easing-[ease] xs:w-(--popup-width) relative h-(--popup-height) w-(--popup-width) origin-(--transform-origin) rounded-lg bg-popover text-popover-foreground shadow ring-1 ring-foreground/10 transition-[opacity,transform,width,height,scale,translate] duration-350 ease-(--ease-overlay-emphasized) outline-none data-ending-style:scale-90 data-ending-style:opacity-0 data-ending-style:duration-150 data-starting-style:scale-90 data-starting-style:opacity-0">
					<NavigationMenuPrimitive.Viewport className="relative size-full overflow-hidden" />
				</NavigationMenuPrimitive.Popup>
			</NavigationMenuPrimitive.Positioner>
		</NavigationMenuPrimitive.Portal>
	);
});

const NavigationMenuLink = React.forwardRef<HTMLAnchorElement, NavigationMenuPrimitive.Link.Props>(function NavigationMenuLink(
	{ className, ...props },
	ref,
): React.JSX.Element {
	return (
		<NavigationMenuPrimitive.Link
			ref={ref}
			data-slot="navigation-menu-link"
			className={cn(
				"flex items-center gap-1.5 rounded-md p-2 text-sm transition-all outline-none hover:bg-muted focus:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-1 in-data-[slot=navigation-menu-content]:rounded-sm data-[active=true]:bg-muted/50 data-[active=true]:hover:bg-muted data-[active=true]:focus:bg-muted [&_svg:not([class*='size-'])]:size-4",
				className,
			)}
			{...props}
		/>
	);
});

const NavigationMenuIndicator = React.forwardRef<HTMLSpanElement, NavigationMenuPrimitive.Icon.Props>(function NavigationMenuIndicator(
	{ className, ...props },
	ref,
): React.JSX.Element {
	return (
		<NavigationMenuPrimitive.Icon
			ref={ref}
			data-slot="navigation-menu-indicator"
			className={cn(
				"top-full z-1 flex h-1.5 items-end justify-center overflow-hidden data-[state=hidden]:animate-out data-[state=hidden]:fade-out data-[state=visible]:animate-in data-[state=visible]:fade-in",
				className,
			)}
			{...props}>
			<div className="relative top-[60%] h-2 w-2 rotate-45 rounded-ss-sm bg-border shadow-md" />
		</NavigationMenuPrimitive.Icon>
	);
});

export {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuIndicator,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	NavigationMenuTrigger,
	navigationMenuTriggerStyle,
	NavigationMenuPositioner,
};
