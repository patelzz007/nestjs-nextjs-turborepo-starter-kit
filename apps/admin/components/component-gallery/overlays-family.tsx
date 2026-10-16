"use client";

import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger } from "@workspace/ui/components/alert-dialog";
import { Button } from "@workspace/ui/components/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from "@workspace/ui/components/command";
import {
	ContextMenu,
	ContextMenuCheckboxItem,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuLabel,
	ContextMenuSeparator,
	ContextMenuShortcut,
	ContextMenuTrigger,
} from "@workspace/ui/components/context-menu";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@workspace/ui/components/dialog";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@workspace/ui/components/drawer";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { EntityAvatar } from "@workspace/ui/components/entity-avatar";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@workspace/ui/components/hover-card";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@workspace/ui/components/popover";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@workspace/ui/components/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { Archive, Copy, LogOut, Pencil, Settings, Trash2, User } from "lucide-react";
import * as React from "react";
import { z } from "zod";

import { GALLERY_ENTRIES } from "@/components/component-gallery/gallery-catalog";
import { ComponentSection, DemoRow, DemoSurface, DemoValue } from "@/components/component-gallery/gallery-section";

const SheetSideSchema = z.enum(["top", "right", "bottom", "left"]);
type SheetSide = z.output<typeof SheetSideSchema>;
const SHEET_SIDES: readonly SheetSide[] = SheetSideSchema.options;

const AlertSeveritySchema = z.enum(["info", "warning", "critical"]);
type AlertSeverity = z.output<typeof AlertSeveritySchema>;
const ALERT_SEVERITIES: readonly AlertSeverity[] = AlertSeveritySchema.options;

const SortOrderSchema = z.enum(["newest", "oldest", "name"]);
type SortOrder = z.output<typeof SortOrderSchema>;

const DIALOG_NAME_INPUT_ID = "gallery-dialog-name";

function readInputValue(event: React.ChangeEvent<HTMLInputElement>): string {
	return event.currentTarget.value;
}

function DialogDemo(): React.JSX.Element {
	const [isOpen, setIsOpen] = React.useState<boolean>(false);
	const [name, setName] = React.useState<string>("Acme Coffee");
	const [savedName, setSavedName] = React.useState<string>("Acme Coffee");

	const handleNameChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setName(readInputValue(event));
	}, []);

	const handleSave = React.useCallback((): void => {
		setSavedName(name);
		setIsOpen(false);
	}, [name]);

	return (
		<DemoSurface>
			<DemoRow label="Controlled open state">
				<Dialog open={isOpen} onOpenChange={setIsOpen}>
					<DialogTrigger render={<Button variant="outline" />}>Rename store</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Rename store</DialogTitle>
							<DialogDescription>The new name shows on receipts and in the merchant portal.</DialogDescription>
						</DialogHeader>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor={DIALOG_NAME_INPUT_ID}>Store name</Label>
							<Input id={DIALOG_NAME_INPUT_ID} value={name} onChange={handleNameChange} />
						</div>
						<DialogFooter>
							<DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
							<Button type="button" onClick={handleSave}>
								Save
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
				<DemoValue label="Dialog">{isOpen ? "open" : "closed"}</DemoValue>
				<DemoValue label="Saved name">{savedName}</DemoValue>
			</DemoRow>
		</DemoSurface>
	);
}

interface SeverityDialogProps {
	readonly severity: AlertSeverity;
	readonly onConfirm: (severity: AlertSeverity) => void;
}

/** One severity tier's confirmation; reports which tier was confirmed. */
function SeverityDialog({ severity, onConfirm }: SeverityDialogProps): React.JSX.Element {
	const handleConfirm = React.useCallback((): void => {
		onConfirm(severity);
	}, [onConfirm, severity]);

	return (
		<AlertDialog>
			<AlertDialogTrigger render={<Button variant={severity === "critical" ? "destructive" : "outline"} />}>Severity {severity}</AlertDialogTrigger>
			<AlertDialogContent severity={severity} onConfirm={handleConfirm}>
				<AlertDialogTitle>Archive this merchant?</AlertDialogTitle>
				<AlertDialogDescription>The {severity} tier sets the icon and the tone of the confirm button.</AlertDialogDescription>
			</AlertDialogContent>
		</AlertDialog>
	);
}

function AlertDialogDemo(): React.JSX.Element {
	const [lastConfirmed, setLastConfirmed] = React.useState<AlertSeverity | null>(null);

	return (
		<DemoSurface>
			<DemoRow label="Severity tiers">
				{ALERT_SEVERITIES.map((severity) => (
					<SeverityDialog key={severity} severity={severity} onConfirm={setLastConfirmed} />
				))}
			</DemoRow>
			<p className="text-xs text-muted-foreground">Keyword, reason, countdown and loading confirmations are shown with Alert below.</p>
			<DemoValue label="Last confirmed">{lastConfirmed ?? "none"}</DemoValue>
		</DemoSurface>
	);
}

function SheetDemo(): React.JSX.Element {
	return (
		<DemoSurface>
			<DemoRow label="Sides">
				{SHEET_SIDES.map((side) => (
					<Sheet key={side}>
						<SheetTrigger render={<Button variant="outline" />}>Open {side}</SheetTrigger>
						<SheetContent side={side}>
							<SheetHeader>
								<SheetTitle>Filters</SheetTitle>
								<SheetDescription>This sheet slides in from the {side}.</SheetDescription>
							</SheetHeader>
							<SheetFooter>
								<SheetClose render={<Button variant="outline" />}>Close</SheetClose>
							</SheetFooter>
						</SheetContent>
					</Sheet>
				))}
			</DemoRow>
		</DemoSurface>
	);
}

function DrawerDemo(): React.JSX.Element {
	return (
		<DemoSurface>
			<DemoRow label="Bottom drawer, swipe to dismiss">
				<Drawer showSwipeHandle>
					<DrawerTrigger render={<Button variant="outline" />}>Open drawer</DrawerTrigger>
					<DrawerContent>
						<DrawerHeader>
							<DrawerTitle>Share this report</DrawerTitle>
							<DrawerDescription>Drag the handle down, press Escape or use the button to close it.</DrawerDescription>
						</DrawerHeader>
						<DrawerFooter>
							<DrawerClose render={<Button variant="outline" />}>Done</DrawerClose>
						</DrawerFooter>
					</DrawerContent>
				</Drawer>
			</DemoRow>
		</DemoSurface>
	);
}

function PopoverDemo(): React.JSX.Element {
	return (
		<DemoSurface>
			<DemoRow label="Anchored content">
				<Popover>
					<PopoverTrigger render={<Button variant="outline" />}>Dimensions</PopoverTrigger>
					<PopoverContent className="w-72">
						<PopoverHeader>
							<PopoverTitle>Dimensions</PopoverTitle>
							<PopoverDescription>Set the size of the layer.</PopoverDescription>
						</PopoverHeader>
						<div className="grid grid-cols-2 gap-2">
							<Input aria-label="Width" defaultValue="100%" />
							<Input aria-label="Height" defaultValue="25px" />
						</div>
					</PopoverContent>
				</Popover>
			</DemoRow>
		</DemoSurface>
	);
}

function HoverCardDemo(): React.JSX.Element {
	return (
		<DemoSurface>
			<p className="text-sm text-muted-foreground">
				Built by{" "}
				<HoverCard>
					<HoverCardTrigger href="#component-hover-card" className="font-medium text-primary underline-offset-4 hover:underline">
						@acme-design
					</HoverCardTrigger>
					<HoverCardContent className="w-72">
						<div className="flex gap-3">
							<EntityAvatar name="Acme Design" size="md" />
							<div className="flex flex-col gap-1">
								<p className="text-sm font-semibold text-foreground">Acme Design</p>
								<p className="text-xs text-muted-foreground">The team behind the UI kit. Joined March 2024.</p>
							</div>
						</div>
					</HoverCardContent>
				</HoverCard>
				, hover or focus the handle to preview it.
			</p>
		</DemoSurface>
	);
}

function TooltipDemo(): React.JSX.Element {
	return (
		<DemoSurface>
			<DemoRow label="Sides">
				<Tooltip>
					<TooltipTrigger render={<Button variant="outline" size="icon" aria-label="Copy" />}>
						<Copy />
					</TooltipTrigger>
					<TooltipContent>Copy to clipboard</TooltipContent>
				</Tooltip>
				<Tooltip>
					<TooltipTrigger render={<Button variant="outline" />}>Bottom</TooltipTrigger>
					<TooltipContent side="bottom">Shown below the trigger</TooltipContent>
				</Tooltip>
				<Tooltip>
					<TooltipTrigger render={<Button variant="outline" />}>Right</TooltipTrigger>
					<TooltipContent side="right">Shown to the right</TooltipContent>
				</Tooltip>
			</DemoRow>
		</DemoSurface>
	);
}

function DropdownMenuDemo(): React.JSX.Element {
	const [isCompact, setIsCompact] = React.useState<boolean>(false);
	const [sortOrder, setSortOrder] = React.useState<SortOrder>("newest");

	const handleSortChange = React.useCallback((value: string): void => {
		const parsed = SortOrderSchema.safeParse(value);
		if (parsed.success) {
			setSortOrder(parsed.data);
		}
	}, []);

	return (
		<DemoSurface>
			<DemoRow label="Items, checkbox, radio group and submenu">
				<DropdownMenu>
					<DropdownMenuTrigger render={<Button variant="outline" />}>Open menu</DropdownMenuTrigger>
					<DropdownMenuContent className="w-56">
						<DropdownMenuGroup>
							<DropdownMenuLabel>My account</DropdownMenuLabel>
							<DropdownMenuItem>
								<User />
								Profile
								<DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
							</DropdownMenuItem>
							<DropdownMenuItem>
								<Settings />
								Settings
							</DropdownMenuItem>
							<DropdownMenuItem disabled>
								<Archive />
								Archive (disabled)
							</DropdownMenuItem>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuCheckboxItem checked={isCompact} onCheckedChange={setIsCompact}>
							Compact rows
						</DropdownMenuCheckboxItem>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuLabel>Sort by</DropdownMenuLabel>
							<DropdownMenuRadioGroup value={sortOrder} onValueChange={handleSortChange}>
								<DropdownMenuRadioItem value="newest">Newest first</DropdownMenuRadioItem>
								<DropdownMenuRadioItem value="oldest">Oldest first</DropdownMenuRadioItem>
								<DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
							</DropdownMenuRadioGroup>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuSub>
							<DropdownMenuSubTrigger>Share</DropdownMenuSubTrigger>
							<DropdownMenuSubContent>
								<DropdownMenuItem>Email link</DropdownMenuItem>
								<DropdownMenuItem>Copy link</DropdownMenuItem>
							</DropdownMenuSubContent>
						</DropdownMenuSub>
						<DropdownMenuSeparator />
						<DropdownMenuItem variant="destructive">
							<LogOut />
							Sign out
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
				<DemoValue label="Compact rows">{isCompact ? "on" : "off"}</DemoValue>
				<DemoValue label="Sort by">{sortOrder}</DemoValue>
			</DemoRow>
		</DemoSurface>
	);
}

function ContextMenuDemo(): React.JSX.Element {
	const [isPinned, setIsPinned] = React.useState<boolean>(true);

	return (
		<DemoSurface>
			<ContextMenu>
				<ContextMenuTrigger className="flex h-32 w-full max-w-md items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
					Right-click (or long-press) here
				</ContextMenuTrigger>
				<ContextMenuContent className="w-52">
					<ContextMenuLabel>File</ContextMenuLabel>
					<ContextMenuItem>
						<Pencil />
						Rename
						<ContextMenuShortcut>F2</ContextMenuShortcut>
					</ContextMenuItem>
					<ContextMenuItem>
						<Copy />
						Duplicate
					</ContextMenuItem>
					<ContextMenuCheckboxItem checked={isPinned} onCheckedChange={setIsPinned}>
						Pinned
					</ContextMenuCheckboxItem>
					<ContextMenuSeparator />
					<ContextMenuItem variant="destructive">
						<Trash2 />
						Delete
					</ContextMenuItem>
				</ContextMenuContent>
			</ContextMenu>
			<DemoValue label="Pinned">{isPinned ? "yes" : "no"}</DemoValue>
		</DemoSurface>
	);
}

function CommandDemo(): React.JSX.Element {
	const [lastCommand, setLastCommand] = React.useState<string | null>(null);

	return (
		<DemoSurface>
			<Command className="max-w-md rounded-lg border">
				<CommandInput placeholder="Type a command or search…" />
				<CommandList>
					<CommandEmpty>No results found.</CommandEmpty>
					<CommandGroup heading="Suggestions">
						<CommandItem value="Calendar" onSelect={setLastCommand}>
							Calendar
						</CommandItem>
						<CommandItem value="Search merchants" onSelect={setLastCommand}>
							Search merchants
						</CommandItem>
						<CommandItem value="Disabled command" disabled>
							Disabled command
						</CommandItem>
					</CommandGroup>
					<CommandSeparator />
					<CommandGroup heading="Settings">
						<CommandItem value="Profile" onSelect={setLastCommand}>
							Profile
							<CommandShortcut>⌘P</CommandShortcut>
						</CommandItem>
						<CommandItem value="Settings" onSelect={setLastCommand}>
							Settings
							<CommandShortcut>⌘S</CommandShortcut>
						</CommandItem>
					</CommandGroup>
				</CommandList>
			</Command>
			<DemoValue label="Last command">{lastCommand ?? "none"}</DemoValue>
		</DemoSurface>
	);
}

/** Overlays: content layered above the page. Smart: owns every demo's open and selection state. */
export function OverlaysFamily(): React.JSX.Element {
	return (
		<>
			<ComponentSection entry={GALLERY_ENTRIES.dialog} height="h-24">
				<DialogDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.alertDialog} height="h-40">
				<AlertDialogDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.sheet} height="h-24">
				<SheetDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.drawer} height="h-24">
				<DrawerDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.popover} height="h-24">
				<PopoverDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.hoverCard} height="h-24">
				<HoverCardDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.tooltip} height="h-24">
				<TooltipDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.dropdownMenu} height="h-24">
				<DropdownMenuDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.contextMenu} height="h-56">
				<ContextMenuDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.command} height="h-96">
				<CommandDemo />
			</ComponentSection>
		</>
	);
}
