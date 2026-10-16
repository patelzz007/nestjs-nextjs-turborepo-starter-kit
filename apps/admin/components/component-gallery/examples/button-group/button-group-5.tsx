import * as React from "react";
import { ClockIcon, ExternalLinkIcon, MoreHorizontalIcon, PlusIcon, SettingsIcon, UserIcon, UsersIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup, ButtonGroupText } from "@workspace/ui/components/button-group";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";

interface TeamMember {
	readonly name: string;
	readonly src: string;
	readonly fallback: string;
}

const team: readonly TeamMember[] = [
	{ name: "Sarah Chen", src: "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80", fallback: "SC" },
	{ name: "Alex Kim", src: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80", fallback: "AK" },
	{ name: "Maria Garcia", src: "https://images.unsplash.com/photo-1620075225255-8c2051b6c015?w=96&h=96&dpr=2&q=80", fallback: "MG" },
];

export function ButtonGroup5Example(): React.JSX.Element {
	return (
		<ButtonGroup>
			{/* Team Context */}
			<Button variant="outline">
				<UsersIcon aria-hidden="true" />
				<span>Team</span>
			</Button>

			{/* Active Members - Inspired by Avatar Patterns */}
			<ButtonGroupText className="gap-0 bg-transparent">
				<AvatarGroup>
					{team.map((member) => (
						<Avatar key={member.name} className="size-5">
							<AvatarImage src={member.src} alt={member.name} />
							<AvatarFallback>{member.fallback}</AvatarFallback>
						</Avatar>
					))}
				</AvatarGroup>
				<div className="ml-2 flex items-center gap-1">
					<span className="size-1.5 rounded-full bg-success" />
					<span className="text-xs font-medium text-muted-foreground">3 Live</span>
				</div>
			</ButtonGroupText>

			{/* Collaboration Actions */}
			<Button variant="outline" size="icon" aria-label="Add">
				<PlusIcon aria-hidden="true" />
			</Button>
			<Button variant="outline" size="icon" aria-label="History">
				<ClockIcon aria-hidden="true" />
			</Button>

			{/* Options Dropdown */}
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button variant="outline" size="icon" aria-label="More options">
							<MoreHorizontalIcon aria-hidden="true" />
						</Button>
					}
				/>
				<DropdownMenuContent align="end" className="w-48">
					<DropdownMenuGroup>
						<DropdownMenuLabel>Team Settings</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuItem>
							<UserIcon aria-hidden="true" />
							<span>Manage members</span>
						</DropdownMenuItem>
						<DropdownMenuItem>
							<SettingsIcon aria-hidden="true" />
							<span>Team preferences</span>
						</DropdownMenuItem>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuItem>
						<ExternalLinkIcon aria-hidden="true" />
						<span>Open dashboard</span>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</ButtonGroup>
	);
}
