import * as React from "react";
import { ExternalLinkIcon, MoreHorizontalIcon, SettingsIcon, UserIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";

export function Card6Example(): React.JSX.Element {
	return (
		<Card className="w-full max-w-xs gap-2 pt-5">
			<CardHeader className="flex items-center justify-between">
				<CardTitle>Need a help in Claim?</CardTitle>
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<Button variant="ghost" size="icon">
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
			</CardHeader>
			<CardContent className="mb-2">
				<p>Go to this step by step guideline process on how to certify for your weekly benefits:</p>
			</CardContent>
			<CardFooter>
				<Button size="sm">
					<Avatar className="size-5">
						<AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
						<AvatarFallback>CH</AvatarFallback>
					</Avatar>
					<span className="text-xs">@shadcn</span>
				</Button>
			</CardFooter>
		</Card>
	);
}
