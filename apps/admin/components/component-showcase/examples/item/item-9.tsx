import * as React from "react";
import { MoreHorizontalIcon } from "lucide-react";
import { Badge, type BadgeVariant } from "@workspace/ui/components/badge";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@workspace/ui/components/item";

interface TeamMember {
	readonly name: string;
	readonly initials: string;
	readonly email: string;
	readonly avatar: string;
	readonly role: string;
	readonly roleVariant: BadgeVariant;
}

const MEMBERS: readonly TeamMember[] = [
	{
		name: "Sarah Chen",
		initials: "SC",
		email: "sarah@example.com",
		avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&dpr=2&q=80",
		role: "Admin",
		roleVariant: "default",
	},
	{
		name: "Alex Johnson",
		initials: "AJ",
		email: "alex@example.com",
		avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80",
		role: "Editor",
		roleVariant: "info-light",
	},
	{
		name: "Emily Park",
		initials: "EP",
		email: "emily@example.com",
		avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=96&h=96&dpr=2&q=80",
		role: "Viewer",
		roleVariant: "outline",
	},
];

export function Item9Example(): React.JSX.Element {
	return (
		<div className="mx-auto flex w-full max-w-md flex-col">
			<ItemGroup>
				{MEMBERS.map((member: TeamMember): React.JSX.Element => (
					<div key={member.email}>
						<Item variant="outline" size="xs">
							<ItemMedia>
								<Avatar>
									<AvatarImage src={member.avatar} alt={member.name} />
									<AvatarFallback>{member.initials}</AvatarFallback>
								</Avatar>
							</ItemMedia>
							<ItemContent>
								<ItemTitle>{member.name}</ItemTitle>
								<ItemDescription>{member.email}</ItemDescription>
							</ItemContent>
							<ItemActions>
								<Badge variant={member.roleVariant} size="sm">
									{member.role}
								</Badge>
								<DropdownMenu>
									<DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="ml-1 size-7" />}>
										<MoreHorizontalIcon />
										<span className="sr-only">Actions</span>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem>Change Role</DropdownMenuItem>
										<DropdownMenuItem>View Profile</DropdownMenuItem>
										<DropdownMenuSeparator />
										<DropdownMenuItem variant="destructive">Remove</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</ItemActions>
						</Item>
					</div>
				))}
			</ItemGroup>
		</div>
	);
}
