"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@workspace/ui/components/overlay/dialog";
import { InputGroup, InputGroupAddon } from "@workspace/ui/components/form/input-group";
import { cn } from "@workspace/ui/lib/utils";
import { Command as CommandPrimitive } from "cmdk";
import { SearchIcon, CheckIcon } from "lucide-react";
import * as React from "react";

const Command = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof CommandPrimitive>>(function Command({ className, ...props }, ref): React.JSX.Element {
	return (
		<CommandPrimitive
			ref={ref}
			data-slot="command"
			className={cn("flex size-full flex-col overflow-hidden rounded-xl! bg-popover p-1 text-popover-foreground", className)}
			{...props}
		/>
	);
});

function CommandDialog({
	title,
	description,
	children,
	className,
	showCloseButton = false,
	...props
}: Omit<React.ComponentProps<typeof Dialog>, "children"> & {
	readonly title: string;
	readonly description: string;
	className?: string;
	showCloseButton?: boolean;
	children: React.ReactNode;
}): React.JSX.Element {
	return (
		<Dialog {...props}>
			<DialogHeader className="sr-only">
				<DialogTitle>{title}</DialogTitle>
				<DialogDescription>{description}</DialogDescription>
			</DialogHeader>
			<DialogContent className={cn("overflow-hidden rounded-xl! p-0", className)} showCloseButton={showCloseButton}>
				{children}
			</DialogContent>
		</Dialog>
	);
}

const CommandInput = React.forwardRef<HTMLInputElement, React.ComponentProps<typeof CommandPrimitive.Input>>(function CommandInput(
	{ className, ...props },
	ref,
): React.JSX.Element {
	return (
		<div data-slot="command-input-wrapper" className="p-1 pb-0">
			<InputGroup className="h-8! rounded-lg! border-input/30 bg-input/30 shadow-none! *:data-[slot=input-group-addon]:ps-2!">
				<CommandPrimitive.Input
					ref={ref}
					data-slot="command-input"
					className={cn("w-full text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50", className)}
					{...props}
				/>
				<InputGroupAddon>
					<SearchIcon className="size-4 shrink-0 opacity-50" />
				</InputGroupAddon>
			</InputGroup>
		</div>
	);
});

const CommandList = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof CommandPrimitive.List>>(function CommandList(
	{ className, ...props },
	ref,
): React.JSX.Element {
	return (
		<CommandPrimitive.List
			ref={ref}
			data-slot="command-list"
			className={cn("no-scrollbar max-h-72 scroll-py-1 overflow-x-hidden overflow-y-auto outline-none", className)}
			{...props}
		/>
	);
});

const CommandEmpty = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof CommandPrimitive.Empty>>(function CommandEmpty(
	{ className, ...props },
	ref,
): React.JSX.Element {
	return <CommandPrimitive.Empty ref={ref} data-slot="command-empty" className={cn("py-6 text-center text-sm", className)} {...props} />;
});

const CommandGroup = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof CommandPrimitive.Group>>(function CommandGroup(
	{ className, ...props },
	ref,
): React.JSX.Element {
	return (
		<CommandPrimitive.Group
			ref={ref}
			data-slot="command-group"
			className={cn(
				"overflow-hidden p-1 text-foreground **:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:text-muted-foreground",
				className,
			)}
			{...props}
		/>
	);
});

const CommandSeparator = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof CommandPrimitive.Separator>>(function CommandSeparator(
	{ className, ...props },
	ref,
): React.JSX.Element {
	return <CommandPrimitive.Separator ref={ref} data-slot="command-separator" className={cn("-mx-1 h-px w-auto bg-border", className)} {...props} />;
});

const CommandItem = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof CommandPrimitive.Item>>(function CommandItem(
	{ className, children, ...props },
	ref,
): React.JSX.Element {
	return (
		<CommandPrimitive.Item
			ref={ref}
			data-slot="command-item"
			className={cn(
				"group/command-item relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none in-data-[slot=dialog-content]:rounded-lg! data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-selected:bg-muted data-selected:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-selected:**:[svg]:text-foreground",
				className,
			)}
			{...props}>
			{children}
			<CheckIcon className="ms-auto opacity-0 group-has-data-[slot=command-shortcut]/command-item:hidden group-data-[checked=true]/command-item:opacity-100" />
		</CommandPrimitive.Item>
	);
});

const CommandShortcut = React.forwardRef<HTMLSpanElement, React.ComponentProps<"span">>(function CommandShortcut({ className, ...props }, ref): React.JSX.Element {
	return (
		<span
			ref={ref}
			data-slot="command-shortcut"
			className={cn("ms-auto text-xs tracking-widest text-muted-foreground group-data-selected/command-item:text-foreground", className)}
			{...props}
		/>
	);
});

export { Command, CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandShortcut, CommandSeparator };
