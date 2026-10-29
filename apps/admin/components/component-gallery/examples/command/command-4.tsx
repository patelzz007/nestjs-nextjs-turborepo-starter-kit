"use client";

import * as React from "react";
import {
	BellIcon,
	CalculatorIcon,
	CalendarIcon,
	ClipboardIcon,
	CodeIcon,
	CopyIcon,
	CreditCardIcon,
	FileTextIcon,
	FolderIcon,
	FolderPlusIcon,
	HelpCircleIcon,
	HouseIcon,
	ImageIcon,
	InboxIcon,
	LayoutGridIcon,
	ListIcon,
	PlusIcon,
	ScissorsIcon,
	SettingsIcon,
	TrashIcon,
	UserIcon,
	ZoomInIcon,
	ZoomOutIcon,
} from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@workspace/ui/components/button";
import {
	Command,
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut,
} from "@workspace/ui/components/command";

export function Command4Example(): React.JSX.Element {
	const [open, setOpen] = useState(false);
	const openPalette = useCallback((): void => {
		setOpen(true);
	}, []);

	return (
		<>
			<Button onClick={openPalette} variant="outline">
				Open Command
			</Button>
			<CommandDialog title="Command palette" description="Search for a command to run" open={open} onOpenChange={setOpen}>
				<Command>
					<CommandInput placeholder="Type a command or search..." />
					<CommandList>
						<CommandEmpty>No results found.</CommandEmpty>
						<CommandGroup heading="Navigation">
							<CommandItem value="Home">
								<HouseIcon />
								<span>Home</span>
								<CommandShortcut>⌘H</CommandShortcut>
							</CommandItem>
							<CommandItem value="Inbox">
								<InboxIcon />
								<span>Inbox</span>
								<CommandShortcut>⌘I</CommandShortcut>
							</CommandItem>
							<CommandItem value="Documents">
								<FileTextIcon />
								<span>Documents</span>
								<CommandShortcut>⌘D</CommandShortcut>
							</CommandItem>
							<CommandItem value="Folders">
								<FolderIcon />
								<span>Folders</span>
								<CommandShortcut>⌘F</CommandShortcut>
							</CommandItem>
						</CommandGroup>
						<CommandSeparator />
						<CommandGroup heading="Actions">
							<CommandItem value="New File">
								<PlusIcon />
								<span>New File</span>
								<CommandShortcut>⌘N</CommandShortcut>
							</CommandItem>
							<CommandItem value="New Folder">
								<FolderPlusIcon />
								<span>New Folder</span>
								<CommandShortcut>⇧⌘N</CommandShortcut>
							</CommandItem>
							<CommandItem value="Copy">
								<CopyIcon />
								<span>Copy</span>
								<CommandShortcut>⌘C</CommandShortcut>
							</CommandItem>
							<CommandItem value="Cut">
								<ScissorsIcon />
								<span>Cut</span>
								<CommandShortcut>⌘X</CommandShortcut>
							</CommandItem>
							<CommandItem value="Paste">
								<ClipboardIcon />
								<span>Paste</span>
								<CommandShortcut>⌘V</CommandShortcut>
							</CommandItem>
							<CommandItem value="Delete">
								<TrashIcon />
								<span>Delete</span>
								<CommandShortcut>⌫</CommandShortcut>
							</CommandItem>
						</CommandGroup>
						<CommandSeparator />
						<CommandGroup heading="View">
							<CommandItem value="Grid View">
								<LayoutGridIcon />
								<span>Grid View</span>
							</CommandItem>
							<CommandItem value="List View">
								<ListIcon />
								<span>List View</span>
							</CommandItem>
							<CommandItem value="Zoom In">
								<ZoomInIcon />
								<span>Zoom In</span>
								<CommandShortcut>⌘+</CommandShortcut>
							</CommandItem>
							<CommandItem value="Zoom Out">
								<ZoomOutIcon />
								<span>Zoom Out</span>
								<CommandShortcut>⌘-</CommandShortcut>
							</CommandItem>
						</CommandGroup>
						<CommandSeparator />
						<CommandGroup heading="Account">
							<CommandItem value="Profile">
								<UserIcon />
								<span>Profile</span>
								<CommandShortcut>⌘P</CommandShortcut>
							</CommandItem>
							<CommandItem value="Billing">
								<CreditCardIcon />
								<span>Billing</span>
								<CommandShortcut>⌘B</CommandShortcut>
							</CommandItem>
							<CommandItem value="Settings">
								<SettingsIcon />
								<span>Settings</span>
								<CommandShortcut>⌘S</CommandShortcut>
							</CommandItem>
							<CommandItem value="Notifications">
								<BellIcon />
								<span>Notifications</span>
							</CommandItem>
							<CommandItem value="Help & Support">
								<HelpCircleIcon />
								<span>Help & Support</span>
							</CommandItem>
						</CommandGroup>
						<CommandSeparator />
						<CommandGroup heading="Tools">
							<CommandItem value="Calculator">
								<CalculatorIcon />
								<span>Calculator</span>
							</CommandItem>
							<CommandItem value="Calendar">
								<CalendarIcon />
								<span>Calendar</span>
							</CommandItem>
							<CommandItem value="Image Editor">
								<ImageIcon />
								<span>Image Editor</span>
							</CommandItem>
							<CommandItem value="Code Editor">
								<CodeIcon />
								<span>Code Editor</span>
							</CommandItem>
						</CommandGroup>
					</CommandList>
				</Command>
			</CommandDialog>
		</>
	);
}
