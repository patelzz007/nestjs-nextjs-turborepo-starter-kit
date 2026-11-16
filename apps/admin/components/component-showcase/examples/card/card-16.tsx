import * as React from "react";
import { CheckIcon, MoreVerticalIcon } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";

import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";

export function Card16Example(): React.JSX.Element {
	return (
		<Card className="w-full max-w-sm p-0">
			<CardContent className="p-0">
				<div className="flex items-center justify-between border-b px-3 py-2">
					<Badge variant="secondary">
						<CheckIcon aria-hidden="true" />
						Live
					</Badge>
					<DropdownMenu>
						<DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="text-muted-foreground" aria-label="More options" />}>
							<MoreVerticalIcon aria-hidden="true" />
						</DropdownMenuTrigger>
						<DropdownMenuContent className="w-32" align="end">
							<DropdownMenuGroup>
								<DropdownMenuItem>Edit</DropdownMenuItem>
								<DropdownMenuItem>Copy link</DropdownMenuItem>
							</DropdownMenuGroup>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
				<div className="space-y-3 p-4">
					<div className="flex items-start justify-between gap-2">
						<h3 className="text-sm leading-tight font-medium">Integration name</h3>
						<Badge variant="success-light" size="sm">
							Installed
						</Badge>
					</div>
					<p className="text-sm text-muted-foreground">Short description of the integration and what it does in one line.</p>
					<AvatarGroup>
						<Avatar className="size-6">
							<AvatarImage src="https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80" alt="User 1" />
							<AvatarFallback>SC</AvatarFallback>
						</Avatar>
						<Avatar className="size-6">
							<AvatarImage src="https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=96&h=96&dpr=2&q=80" alt="User 2" />
							<AvatarFallback>MR</AvatarFallback>
						</Avatar>
						<Avatar className="size-6">
							<AvatarImage src="https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=96&h=96&dpr=2&q=80" alt="User 3" />
							<AvatarFallback>EW</AvatarFallback>
						</Avatar>
						<AvatarGroupCount className="size-6 border text-[10px]">+3</AvatarGroupCount>
					</AvatarGroup>
				</div>
				<div className="border-t p-3">
					<Button variant="outline" className="w-full">
						Open
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
