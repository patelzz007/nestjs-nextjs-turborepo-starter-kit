import * as React from "react";
import { FolderIcon } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";

import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemFooter, ItemHeader, ItemTitle } from "@workspace/ui/components/item";
import { Progress } from "@workspace/ui/components/progress";

export function Item10Example(): React.JSX.Element {
	return (
		<div className="mx-auto flex w-full max-w-xs flex-col gap-3">
			<Item variant="outline">
				<ItemHeader>
					<div className="flex items-center gap-2">
						<FolderIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
						<span className="text-xs text-muted-foreground">Project</span>
					</div>
					<Badge variant="info-light" size="xs">
						In Progress
					</Badge>
				</ItemHeader>
				<ItemContent>
					<ItemTitle>Website Redesign</ItemTitle>
					<ItemDescription>Complete overhaul of the marketing site with a focus on conversion optimization and modern design patterns.</ItemDescription>
				</ItemContent>
				<ItemActions>
					<Button variant="outline" size="sm">
						Open
					</Button>
				</ItemActions>
				<ItemFooter>
					<AvatarGroup>
						<Avatar size="sm">
							<AvatarImage src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&dpr=2&q=80" alt="SC" />
							<AvatarFallback>SC</AvatarFallback>
						</Avatar>
						<Avatar size="sm">
							<AvatarImage src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80" alt="AJ" />
							<AvatarFallback>AJ</AvatarFallback>
						</Avatar>
						<Avatar size="sm">
							<AvatarImage src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=96&h=96&dpr=2&q=80" alt="EP" />
							<AvatarFallback>EP</AvatarFallback>
						</Avatar>
					</AvatarGroup>
					<div className="flex items-center gap-2">
						<Progress value={65} className="w-20" />
						<span className="text-xs text-muted-foreground">65%</span>
					</div>
				</ItemFooter>
			</Item>
		</div>
	);
}
