import * as React from "react";
import { BookOpenIcon, ChevronDownIcon, CreditCardIcon, LifeBuoyIcon, LogOutIcon, PlusIcon, SettingsIcon, UserIcon, UsersIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";

export function DropdownMenu9Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<DropdownMenu>
				<DropdownMenuTrigger render={<Button variant="outline" className="w-52" />}>
					<div className="flex items-center gap-1.5">
						<Avatar className="size-5">
							<AvatarImage src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80" alt="Alex Johnson" />
							<AvatarFallback>AJ</AvatarFallback>
						</Avatar>
						<span className="text-sm font-medium">Alex Johnson</span>
					</div>

					<ChevronDownIcon className="ml-auto size-4 opacity-60" aria-hidden="true" />
				</DropdownMenuTrigger>
				<DropdownMenuContent className="w-56" align="end" sideOffset={8}>
					<DropdownMenuGroup>
						<DropdownMenuLabel className="flex items-center gap-2 py-2">
							<Avatar className="size-8">
								<AvatarImage src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80" alt="Alex Johnson" />
								<AvatarFallback>AJ</AvatarFallback>
							</Avatar>
							<div className="flex flex-col">
								<span className="text-sm font-medium text-foreground">Alex Johnson</span>
								<span className="text-xs font-normal text-muted-foreground">alex@example.com</span>
							</div>
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuItem>
								<UserIcon aria-hidden="true" />
								Profile
								<DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
							</DropdownMenuItem>
							<DropdownMenuItem>
								<CreditCardIcon aria-hidden="true" />
								Billing
							</DropdownMenuItem>
							<DropdownMenuItem>
								<SettingsIcon aria-hidden="true" />
								Settings
								<DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
							</DropdownMenuItem>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuItem>
								<UsersIcon aria-hidden="true" />
								Team
							</DropdownMenuItem>
							<DropdownMenuItem>
								<PlusIcon aria-hidden="true" />
								Invite Members
							</DropdownMenuItem>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuItem>
								<LifeBuoyIcon aria-hidden="true" />
								Support
							</DropdownMenuItem>
							<DropdownMenuItem>
								<BookOpenIcon aria-hidden="true" />
								Documentation
							</DropdownMenuItem>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuItem variant="destructive">
							<LogOutIcon aria-hidden="true" />
							Log out
							<DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
						</DropdownMenuItem>
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
