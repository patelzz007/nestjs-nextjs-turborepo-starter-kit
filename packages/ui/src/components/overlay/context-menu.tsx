"use client";

import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu";
import { cn } from "@workspace/ui/lib/utils";
import { ChevronRightIcon, CheckIcon } from "lucide-react";
import * as React from "react";

// Root/Portal/SubmenuRoot render no DOM element of their own (base-ui
// providers), so like the Select Root they intentionally stay plain functions
// — the ref lives on the parts that render DOM (Trigger/Content/Item/…).
function ContextMenu({ ...props }: ContextMenuPrimitive.Root.Props): React.JSX.Element {
	return <ContextMenuPrimitive.Root data-slot="context-menu" {...props} />;
}

function ContextMenuPortal({ ...props }: ContextMenuPrimitive.Portal.Props): React.JSX.Element {
	return <ContextMenuPrimitive.Portal data-slot="context-menu-portal" {...props} />;
}

const ContextMenuTrigger = React.forwardRef<HTMLDivElement, ContextMenuPrimitive.Trigger.Props>(function ContextMenuTrigger({ className, ...props }, ref): React.JSX.Element {
	return <ContextMenuPrimitive.Trigger ref={ref} data-slot="context-menu-trigger" className={cn("select-none", className)} {...props} />;
});

const ContextMenuContent = React.forwardRef<
	HTMLDivElement,
	ContextMenuPrimitive.Popup.Props & Pick<ContextMenuPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">
>(function ContextMenuContent({ className, align = "start", alignOffset = 4, side = "inline-end", sideOffset = 0, ...props }, ref): React.JSX.Element {
	return (
		<ContextMenuPrimitive.Portal>
			<ContextMenuPrimitive.Positioner className="isolate z-50 outline-none" align={align} alignOffset={alignOffset} side={side} sideOffset={sideOffset}>
				<ContextMenuPrimitive.Popup
					ref={ref}
					data-slot="context-menu-content"
					className={cn(
						"z-50 max-h-(--available-height) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-md bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 outline-none data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-start-2 data-[side=inline-start]:slide-in-from-end-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
						className,
					)}
					{...props}
				/>
			</ContextMenuPrimitive.Positioner>
		</ContextMenuPrimitive.Portal>
	);
});

const ContextMenuGroup = React.forwardRef<HTMLDivElement, ContextMenuPrimitive.Group.Props>(function ContextMenuGroup({ ...props }, ref): React.JSX.Element {
	return <ContextMenuPrimitive.Group ref={ref} data-slot="context-menu-group" {...props} />;
});

const ContextMenuLabel = React.forwardRef<
	HTMLDivElement,
	ContextMenuPrimitive.GroupLabel.Props & {
		inset?: boolean;
	}
>(function ContextMenuLabel({ className, inset, ...props }, ref): React.JSX.Element {
	return (
		<ContextMenuPrimitive.GroupLabel
			ref={ref}
			data-slot="context-menu-label"
			data-inset={inset}
			className={cn("px-2 py-1.5 text-xs font-medium text-muted-foreground data-inset:ps-8", className)}
			{...props}
		/>
	);
});

const ContextMenuItem = React.forwardRef<
	HTMLElement,
	ContextMenuPrimitive.Item.Props & {
		inset?: boolean;
		variant?: "default" | "destructive";
	}
>(function ContextMenuItem({ className, inset, variant = "default", ...props }, ref): React.JSX.Element {
	return (
		<ContextMenuPrimitive.Item
			ref={ref}
			data-slot="context-menu-item"
			data-inset={inset}
			data-variant={variant}
			className={cn(
				"group/context-menu-item relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-inset:ps-8 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 focus:*:[svg]:text-accent-foreground data-[variant=destructive]:*:[svg]:text-destructive",
				className,
			)}
			{...props}
		/>
	);
});

// SubmenuRoot renders no DOM of its own — plain function, ref on the parts.
function ContextMenuSub({ ...props }: ContextMenuPrimitive.SubmenuRoot.Props): React.JSX.Element {
	return <ContextMenuPrimitive.SubmenuRoot data-slot="context-menu-sub" {...props} />;
}

const ContextMenuSubTrigger = React.forwardRef<
	HTMLElement,
	ContextMenuPrimitive.SubmenuTrigger.Props & {
		inset?: boolean;
	}
>(function ContextMenuSubTrigger({ className, inset, children, ...props }, ref): React.JSX.Element {
	return (
		<ContextMenuPrimitive.SubmenuTrigger
			ref={ref}
			data-slot="context-menu-sub-trigger"
			data-inset={inset}
			className={cn(
				"flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-inset:ps-8 data-open:bg-accent data-open:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				className,
			)}
			{...props}>
			{children}
			<ChevronRightIcon className="ms-auto rtl:rotate-180" />
		</ContextMenuPrimitive.SubmenuTrigger>
	);
});

const ContextMenuSubContent = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof ContextMenuContent>>(function ContextMenuSubContent(props, ref): React.JSX.Element {
	return <ContextMenuContent ref={ref} data-slot="context-menu-sub-content" className="shadow-lg" side="inline-end" {...props} />;
});

const ContextMenuCheckboxItem = React.forwardRef<
	HTMLElement,
	ContextMenuPrimitive.CheckboxItem.Props & {
		inset?: boolean;
	}
>(function ContextMenuCheckboxItem({ className, children, checked, inset, ...props }, ref): React.JSX.Element {
	return (
		<ContextMenuPrimitive.CheckboxItem
			ref={ref}
			data-slot="context-menu-checkbox-item"
			data-inset={inset}
			className={cn(
				"relative flex cursor-default items-center gap-2 rounded-sm py-1.5 ps-2 pe-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-inset:ps-8 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				className,
			)}
			checked={checked}
			{...props}>
			<span className="pointer-events-none absolute end-2">
				<ContextMenuPrimitive.CheckboxItemIndicator>
					<CheckIcon />
				</ContextMenuPrimitive.CheckboxItemIndicator>
			</span>
			{children}
		</ContextMenuPrimitive.CheckboxItem>
	);
});

const ContextMenuRadioGroup = React.forwardRef<HTMLDivElement, ContextMenuPrimitive.RadioGroup.Props>(function ContextMenuRadioGroup({ ...props }, ref): React.JSX.Element {
	return <ContextMenuPrimitive.RadioGroup ref={ref} data-slot="context-menu-radio-group" {...props} />;
});

const ContextMenuRadioItem = React.forwardRef<
	HTMLElement,
	ContextMenuPrimitive.RadioItem.Props & {
		inset?: boolean;
	}
>(function ContextMenuRadioItem({ className, children, inset, ...props }, ref): React.JSX.Element {
	return (
		<ContextMenuPrimitive.RadioItem
			ref={ref}
			data-slot="context-menu-radio-item"
			data-inset={inset}
			className={cn(
				"relative flex cursor-default items-center gap-2 rounded-sm py-1.5 ps-2 pe-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-inset:ps-8 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				className,
			)}
			{...props}>
			<span className="pointer-events-none absolute end-2">
				<ContextMenuPrimitive.RadioItemIndicator>
					<CheckIcon />
				</ContextMenuPrimitive.RadioItemIndicator>
			</span>
			{children}
		</ContextMenuPrimitive.RadioItem>
	);
});

const ContextMenuSeparator = React.forwardRef<HTMLDivElement, ContextMenuPrimitive.Separator.Props>(function ContextMenuSeparator(
	{ className, ...props },
	ref,
): React.JSX.Element {
	return <ContextMenuPrimitive.Separator ref={ref} data-slot="context-menu-separator" className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />;
});

const ContextMenuShortcut = React.forwardRef<HTMLSpanElement, React.ComponentProps<"span">>(function ContextMenuShortcut({ className, ...props }, ref): React.JSX.Element {
	return (
		<span
			ref={ref}
			data-slot="context-menu-shortcut"
			className={cn("ms-auto text-xs tracking-widest text-muted-foreground group-focus/context-menu-item:text-accent-foreground", className)}
			{...props}
		/>
	);
});

export {
	ContextMenu,
	ContextMenuTrigger,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuCheckboxItem,
	ContextMenuRadioItem,
	ContextMenuLabel,
	ContextMenuSeparator,
	ContextMenuShortcut,
	ContextMenuGroup,
	ContextMenuPortal,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	ContextMenuRadioGroup,
};
