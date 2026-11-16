import * as React from "react";
import { Badge } from "@workspace/ui/components/badge";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@workspace/ui/components/item";

export function Item5Example(): React.JSX.Element {
	return (
		<div className="mx-auto flex w-full max-w-md flex-col">
			<ItemGroup>
				<Item variant="outline" size="xs">
					<ItemMedia>
						<Avatar>
							<AvatarImage src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&dpr=2&q=80" alt="Sarah Chen" />
							<AvatarFallback>SC</AvatarFallback>
						</Avatar>
					</ItemMedia>
					<ItemContent>
						<ItemTitle>Sarah Chen</ItemTitle>
						<ItemDescription>Team Lead</ItemDescription>
					</ItemContent>
					<ItemActions>
						<Badge variant="success" size="sm">
							Online
						</Badge>
					</ItemActions>
				</Item>
				<Item variant="outline" size="xs">
					<ItemMedia>
						<Avatar>
							<AvatarImage src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80" alt="Alex Johnson" />
							<AvatarFallback>AJ</AvatarFallback>
						</Avatar>
					</ItemMedia>
					<ItemContent>
						<ItemTitle>Alex Johnson</ItemTitle>
						<ItemDescription>Developer</ItemDescription>
					</ItemContent>
					<ItemActions>
						<Badge variant="warning" size="sm">
							Away
						</Badge>
					</ItemActions>
				</Item>
				<Item variant="outline" size="xs">
					<ItemMedia>
						<Avatar>
							<AvatarImage src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=96&h=96&dpr=2&q=80" alt="David Kim" />
							<AvatarFallback>DK</AvatarFallback>
						</Avatar>
					</ItemMedia>
					<ItemContent>
						<ItemTitle>David Kim</ItemTitle>
						<ItemDescription>Designer</ItemDescription>
					</ItemContent>
					<ItemActions>
						<Badge variant="outline" size="sm">
							Offline
						</Badge>
					</ItemActions>
				</Item>
			</ItemGroup>
		</div>
	);
}
