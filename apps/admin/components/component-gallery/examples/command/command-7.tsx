"use client";

import * as React from "react";
import { FileTextIcon, HouseIcon, InboxIcon, LogOutIcon, MoonIcon, PlusIcon, UserPlusIcon } from "lucide-react";
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

export function Command7Example(): React.JSX.Element {
	const [open, setOpen] = useState(false);
	const openPalette = useCallback((): void => {
		setOpen(true);
	}, []);

	return (
		<>
			<Button onClick={openPalette} variant="outline">
				Quick Actions
			</Button>
			<CommandDialog title="Command palette" description="Search for a command to run" open={open} onOpenChange={setOpen}>
				<Command className="**:data-[selected=true]:bg-muted **:data-selected:bg-transparent">
					<CommandInput placeholder="What do you need?" />
					<CommandList>
						<CommandEmpty>No actions found.</CommandEmpty>
						<CommandGroup heading="Create">
							<CommandItem>
								<PlusIcon />
								<span>New Project</span>
								<CommandShortcut>⌘N</CommandShortcut>
							</CommandItem>
							<CommandItem>
								<FileTextIcon />
								<span>New Document</span>
								<CommandShortcut>⌘⇧N</CommandShortcut>
							</CommandItem>
							<CommandItem>
								<UserPlusIcon />
								<span>Invite Member</span>
								<CommandShortcut>⌘I</CommandShortcut>
							</CommandItem>
						</CommandGroup>
						<CommandSeparator />
						<CommandGroup heading="Navigate">
							<CommandItem>
								<HouseIcon />
								<span>Go to Dashboard</span>
								<CommandShortcut>⌘D</CommandShortcut>
							</CommandItem>
							<CommandItem>
								<InboxIcon />
								<span>Go to Inbox</span>
								<CommandShortcut>⌘⇧I</CommandShortcut>
							</CommandItem>
						</CommandGroup>
						<CommandSeparator />
						<CommandGroup heading="System">
							<CommandItem>
								<MoonIcon />
								<span>Toggle Dark Mode</span>
								<CommandShortcut>⌘⇧D</CommandShortcut>
							</CommandItem>
							<CommandItem>
								<LogOutIcon />
								<span>Sign Out</span>
								<CommandShortcut>⌘Q</CommandShortcut>
							</CommandItem>
						</CommandGroup>
					</CommandList>
				</Command>
			</CommandDialog>
		</>
	);
}
