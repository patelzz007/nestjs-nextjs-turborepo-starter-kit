import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@workspace/ui/components/item";

export function Item3Example(): React.JSX.Element {
	return (
		<div className="mx-auto flex w-full max-w-md flex-col gap-2">
			<Item variant="outline" size="xs">
				<ItemMedia>
					<Avatar>
						<AvatarImage src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80" alt="Alex Johnson" />
						<AvatarFallback>AJ</AvatarFallback>
					</Avatar>
				</ItemMedia>
				<ItemContent>
					<ItemTitle>Alex Johnson</ItemTitle>
					<ItemDescription>Senior Software Engineer</ItemDescription>
				</ItemContent>
				<ItemActions>
					<Button variant="outline" size="sm">
						Follow
					</Button>
				</ItemActions>
			</Item>
			<Item variant="outline" size="xs">
				<ItemMedia>
					<Avatar>
						<AvatarImage src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&dpr=2&q=80" alt="Sarah Chen" />
						<AvatarFallback>SC</AvatarFallback>
					</Avatar>
				</ItemMedia>
				<ItemContent>
					<ItemTitle>Sarah Chen</ItemTitle>
					<ItemDescription>Product Designer</ItemDescription>
				</ItemContent>
				<ItemActions>
					<Button size="sm">Following</Button>
				</ItemActions>
			</Item>
		</div>
	);
}
