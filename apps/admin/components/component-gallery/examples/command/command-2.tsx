"use client";

import * as React from "react";
import { CreditCardIcon, SettingsIcon, UserIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@workspace/ui/components/button";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "@workspace/ui/components/command";

export function Command2Example(): React.JSX.Element {
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
						<CommandGroup heading="Settings">
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
						</CommandGroup>
					</CommandList>
				</Command>
			</CommandDialog>
		</>
	);
}
