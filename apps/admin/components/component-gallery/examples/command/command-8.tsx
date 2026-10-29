"use client";

import * as React from "react";
import { BookOpenIcon, ClockIcon, LifeBuoyIcon, MessageSquareIcon, StarIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@workspace/ui/components/button";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@workspace/ui/components/command";

export function Command8Example(): React.JSX.Element {
	const [open, setOpen] = useState(false);
	const openPalette = useCallback((): void => {
		setOpen(true);
	}, []);

	return (
		<>
			<Button onClick={openPalette} variant="outline">
				Search Everything
			</Button>
			<CommandDialog title="Command palette" description="Search for a command to run" open={open} onOpenChange={setOpen}>
				<Command>
					<CommandInput placeholder="Search or jump to..." />
					<CommandList>
						<CommandEmpty>No results found.</CommandEmpty>
						<CommandGroup heading="Favorites">
							<CommandItem value="Design System">
								<StarIcon className="text-tone-yellow" />
								<span>Design System</span>
							</CommandItem>
							<CommandItem value="API Documentation">
								<StarIcon className="text-tone-yellow" />
								<span>API Documentation</span>
							</CommandItem>
						</CommandGroup>
						<CommandSeparator />
						<CommandGroup heading="Recent">
							<CommandItem value="Dashboard Analytics">
								<ClockIcon className="text-muted-foreground" />
								<span>Dashboard Analytics</span>
								<div className="ml-auto" data-slot="command-shortcut">
									<span>2m ago</span>
								</div>
							</CommandItem>
							<CommandItem value="User Settings">
								<ClockIcon className="text-muted-foreground" />
								<span>User Settings</span>
								<div className="ml-auto" data-slot="command-shortcut">
									<span>15m ago</span>
								</div>
							</CommandItem>
							<CommandItem value="Team Members">
								<ClockIcon className="text-muted-foreground" />
								<div className="flex flex-1 items-center justify-between">
									<span>Team Members</span>
									<div className="ml-auto" data-slot="command-shortcut">
										<span>1h ago</span>
									</div>
								</div>
							</CommandItem>
							<CommandItem value="Billing & Plans">
								<ClockIcon className="text-muted-foreground" />
								<span>Billing & Plans</span>
								<div className="ml-auto" data-slot="command-shortcut">
									<span>2h ago</span>
								</div>
							</CommandItem>
						</CommandGroup>
						<CommandSeparator />
						<CommandGroup heading="Quick Links">
							<CommandItem value="Documentation">
								<BookOpenIcon />
								<span>Documentation</span>
							</CommandItem>
							<CommandItem value="Help & Support">
								<LifeBuoyIcon />
								<span>Help & Support</span>
							</CommandItem>
							<CommandItem value="Contact Us">
								<MessageSquareIcon />
								<span>Contact Us</span>
							</CommandItem>
						</CommandGroup>
					</CommandList>
				</Command>
			</CommandDialog>
		</>
	);
}
