"use client";

import * as React from "react";
import { useCallback, useState } from "react";
import { Badge } from "@workspace/ui/components/badge";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@workspace/ui/components/command";

const users = [
	{
		name: "Alex Johnson",
		email: "alex@example.com",
		avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80",
		role: "Admin",
	},
	{
		name: "Sarah Chen",
		email: "sarah@example.com",
		avatar: "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80",
		role: "Editor",
	},
	{
		name: "David Kim",
		email: "david@example.com",
		avatar: "https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?w=96&h=96&dpr=2&q=80",
		role: "Viewer",
	},
	{
		name: "Emma Wilson",
		email: "emma@example.com",
		avatar: "https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=96&h=96&dpr=2&q=80",
		role: "Admin",
	},
	{
		name: "Michael Rodriguez",
		email: "michael@example.com",
		avatar: "https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=96&h=96&dpr=2&q=80",
		role: "Editor",
	},
];

export function Command6Example(): React.JSX.Element {
	const [open, setOpen] = useState(false);
	const openPalette = useCallback((): void => {
		setOpen(true);
	}, []);

	return (
		<>
			<Button onClick={openPalette} variant="outline">
				Search Users
			</Button>
			<CommandDialog title="Command palette" description="Search for a command to run" open={open} onOpenChange={setOpen}>
				<Command>
					<CommandInput placeholder="Search by name or email..." />
					<CommandList>
						<CommandEmpty>No users found.</CommandEmpty>
						<CommandGroup heading="Team Members">
							{users.map((user) => (
								<CommandItem key={user.email} value={user.name} keywords={[user.email]} className="gap-2 py-2">
									<Avatar className="size-6 shrink-0">
										<AvatarImage src={user.avatar} alt={user.name} />
										<AvatarFallback className="text-xs">
											{user.name
												.split(" ")
												.map((name: string): string => name.charAt(0))
												.join("")}
										</AvatarFallback>
									</Avatar>
									<div className="flex flex-1 flex-col">
										<span className="text-sm font-medium">{user.name}</span>
										<span className="text-xs text-muted-foreground">{user.email}</span>
									</div>
									<div className="ml-auto" data-slot="command-shortcut">
										<Badge variant={user.role === "Admin" ? "primary-light" : user.role === "Editor" ? "info-light" : "success-light"} size="sm">
											{user.role}
										</Badge>
									</div>
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</CommandDialog>
		</>
	);
}
