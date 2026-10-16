import * as React from "react";
import { CreditCardIcon, FileTextIcon, LogOutIcon, PlusIcon, SettingsIcon, ShoppingCartIcon, UploadIcon, UserIcon, UserPlusIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { Separator } from "@workspace/ui/components/separator";

const user = {
	name: "Alex Johnson",
	email: "alex@example.com",
	initials: "AJ",
};

export function DropdownMenu15Example(): React.JSX.Element {
	return (
		<div className="flex shrink-0 items-center gap-2">
			<DropdownMenu>
				<DropdownMenuTrigger render={<Button size="sm" />}>
					<PlusIcon aria-hidden="true" />
					New
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-40" sideOffset={12}>
					<DropdownMenuGroup>
						<DropdownMenuLabel>Create</DropdownMenuLabel>
						<DropdownMenuGroup>
							<DropdownMenuItem>
								<UserPlusIcon className="size-4 opacity-60" aria-hidden="true" />
								New Customer
							</DropdownMenuItem>
							<DropdownMenuItem>
								<ShoppingCartIcon className="size-4 opacity-60" aria-hidden="true" />
								New Order
							</DropdownMenuItem>
							<DropdownMenuItem>
								<FileTextIcon className="size-4 opacity-60" aria-hidden="true" />
								New Invoice
							</DropdownMenuItem>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuItem>
							<UploadIcon className="size-4 opacity-60" aria-hidden="true" />
							Import Data
						</DropdownMenuItem>
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>

			<Separator orientation="vertical" className="my-auto h-4" />

			<DropdownMenu>
				<DropdownMenuTrigger>
					<Avatar className="size-6">
						<AvatarImage src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80" alt={user.name} />
						<AvatarFallback>{user.initials}</AvatarFallback>
					</Avatar>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" sideOffset={12} className="w-56">
					<DropdownMenuGroup>
						<DropdownMenuLabel>
							<div className="flex flex-col">
								<span className="text-sm text-foreground">{user.name}</span>
								<span className="text-xs text-muted-foreground">{user.email}</span>
							</div>
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuItem>
								<UserIcon className="size-4 opacity-60" aria-hidden="true" />
								Profile
							</DropdownMenuItem>
							<DropdownMenuItem>
								<CreditCardIcon className="size-4 opacity-60" aria-hidden="true" />
								Billing
							</DropdownMenuItem>
							<DropdownMenuItem>
								<SettingsIcon className="size-4 opacity-60" aria-hidden="true" />
								Settings
							</DropdownMenuItem>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuItem variant="destructive">
							<LogOutIcon aria-hidden="true" />
							Sign out
						</DropdownMenuItem>
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
