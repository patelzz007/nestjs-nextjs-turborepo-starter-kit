import * as React from "react";
import { Badge, type BadgeVariant } from "@workspace/ui/components/badge";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@workspace/ui/components/item";

interface Activity {
	readonly id: string;
	readonly name: string;
	readonly initials: string;
	readonly avatar: string;
	readonly action: string;
	readonly target: string;
	readonly badge: BadgeVariant;
	readonly time: string;
}

const ACTIVITIES: readonly Activity[] = [
	{
		id: "activity-1",
		name: "Sarah Chen",
		initials: "SC",
		avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&dpr=2&q=80",
		action: "deployed",
		target: "v2.4.1 to production",
		badge: "success-light",
		time: "5 min ago",
	},
	{
		id: "activity-2",
		name: "Marcus Johnson",
		initials: "MJ",
		avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80",
		action: "merged",
		target: "feat/dark-mode into main",
		badge: "info-light",
		time: "32 min ago",
	},
	{
		id: "activity-3",
		name: "Emily Park",
		initials: "EP",
		avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=96&h=96&dpr=2&q=80",
		action: "opened",
		target: "issue #284: Fix mobile nav",
		badge: "warning-light",
		time: "1 hour ago",
	},
];

export function Item12Example(): React.JSX.Element {
	return (
		<div className="mx-auto flex w-full max-w-md flex-col">
			<ItemGroup>
				{ACTIVITIES.map((activity: Activity): React.JSX.Element => (
					<div key={activity.id}>
						<Item variant="outline" size="xs">
							<ItemMedia>
								<Avatar size="sm">
									<AvatarImage src={activity.avatar} alt={activity.name} />
									<AvatarFallback>{activity.initials}</AvatarFallback>
								</Avatar>
							</ItemMedia>
							<ItemContent>
								<ItemTitle>{activity.name}</ItemTitle>
								<ItemDescription>
									<Badge variant={activity.badge} size="xs" className="mr-1 align-text-top">
										{activity.action}
									</Badge>
									{activity.target}
								</ItemDescription>
							</ItemContent>
							<ItemActions>
								<span className="text-xs whitespace-nowrap text-muted-foreground">{activity.time}</span>
							</ItemActions>
						</Item>
					</div>
				))}
			</ItemGroup>
		</div>
	);
}
