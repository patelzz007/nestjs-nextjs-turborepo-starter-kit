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
				<Command className="**:data-[selected=true]:bg-muted **:data-selected:bg-transparent">
					<CommandInput placeholder="Type a command or search..." />
					<CommandList>
						<CommandEmpty>No results found.</CommandEmpty>
						<CommandGroup heading="Navigation">
							<CommandItem>
								<HouseIcon />
								<span>Home</span>
								<CommandShortcut>⌘H</CommandShortcut>
							</CommandItem>
							<CommandItem>
								<InboxIcon />
								<span>Inbox</span>
								<CommandShortcut>⌘I</CommandShortcut>
							</CommandItem>
							<CommandItem>
								<FileTextIcon />
								<span>Documents</span>
								<CommandShortcut>⌘D</CommandShortcut>
							</CommandItem>
							<CommandItem>
								<FolderIcon />
								<span>Folders</span>
								<CommandShortcut>⌘F</CommandShortcut>
							</CommandItem>
						</CommandGroup>
						<CommandSeparator />
						<CommandGroup heading="Actions">
							<CommandItem>
								<PlusIcon />
								<span>New File</span>
								<CommandShortcut>⌘N</CommandShortcut>
							</CommandItem>
							<CommandItem>
								<FolderPlusIcon />
								<span>New Folder</span>
								<CommandShortcut>⇧⌘N</CommandShortcut>
							</CommandItem>
							<CommandItem>
								<CopyIcon />
								<span>Copy</span>
								<CommandShortcut>⌘C</CommandShortcut>
							</CommandItem>
							<CommandItem>
								<ScissorsIcon />
								<span>Cut</span>
								<CommandShortcut>⌘X</CommandShortcut>
							</CommandItem>
							<CommandItem>
								<ClipboardIcon />
								<span>Paste</span>
								<CommandShortcut>⌘V</CommandShortcut>
							</CommandItem>
							<CommandItem>
								<TrashIcon />
								<span>Delete</span>
								<CommandShortcut>⌫</CommandShortcut>
							</CommandItem>
						</CommandGroup>
						<CommandSeparator />
						<CommandGroup heading="View">
							<CommandItem>
								<LayoutGridIcon />
								<span>Grid View</span>
							</CommandItem>
							<CommandItem>
								<ListIcon />
								<span>List View</span>
							</CommandItem>
							<CommandItem>
								<ZoomInIcon />
								<span>Zoom In</span>
								<CommandShortcut>⌘+</CommandShortcut>
							</CommandItem>
							<CommandItem>
								<ZoomOutIcon />
								<span>Zoom Out</span>
								<CommandShortcut>⌘-</CommandShortcut>
							</CommandItem>
						</CommandGroup>
						<CommandSeparator />
						<CommandGroup heading="Account">
							<CommandItem>
								<UserIcon />
								<span>Profile</span>
								<CommandShortcut>⌘P</CommandShortcut>
							</CommandItem>
							<CommandItem>
								<CreditCardIcon />
								<span>Billing</span>
								<CommandShortcut>⌘B</CommandShortcut>
							</CommandItem>
							<CommandItem>
								<SettingsIcon />
								<span>Settings</span>
								<CommandShortcut>⌘S</CommandShortcut>
							</CommandItem>
							<CommandItem>
								<BellIcon />
								<span>Notifications</span>
							</CommandItem>
							<CommandItem>
								<HelpCircleIcon />
								<span>Help & Support</span>
							</CommandItem>
						</CommandGroup>
						<CommandSeparator />
						<CommandGroup heading="Tools">
							<CommandItem>
								<CalculatorIcon />
								<span>Calculator</span>
							</CommandItem>
							<CommandItem>
								<CalendarIcon />
								<span>Calendar</span>
							</CommandItem>
							<CommandItem>
								<ImageIcon />
								<span>Image Editor</span>
							</CommandItem>
							<CommandItem>
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
