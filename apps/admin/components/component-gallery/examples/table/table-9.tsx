import * as React from "react";
import { Badge, type BadgeVariant } from "@workspace/ui/components/badge";
import { Frame, FramePanel } from "@workspace/ui/components/frame";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";

interface Activity {
	readonly id: string;
	readonly user: string;
	readonly avatar: string;
	readonly action: string;
	readonly target: string;
	readonly badge: BadgeVariant;
	readonly timestamp: string;
}

const activities: readonly Activity[] = [
	{
		id: "activity-1",
		user: "Sarah Chen",
		avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&dpr=2&q=80",
		action: "Deployed",
		target: "production",
		badge: "success",
		timestamp: "2 minutes ago",
	},
	{
		id: "activity-2",
		user: "Marcus Johnson",
		avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80",
		action: "Merged",
		target: "feat/auth-flow",
		badge: "info",
		timestamp: "15 minutes ago",
	},
	{
		id: "activity-3",
		user: "Emily Park",
		avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=96&h=96&dpr=2&q=80",
		action: "Commented",
		target: "PR #284",
		badge: "outline",
		timestamp: "1 hour ago",
	},
	{
		id: "activity-4",
		user: "David Kim",
		avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=96&h=96&dpr=2&q=80",
		action: "Reverted",
		target: "hotfix/api-crash",
		badge: "destructive",
		timestamp: "3 hours ago",
	},
	{
		id: "activity-5",
		user: "Sofia Davis",
		avatar: "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80",
		action: "Created",
		target: "issue #512",
		badge: "secondary",
		timestamp: "5 hours ago",
	},
];

export function Table9Example(): React.JSX.Element {
	return (
		<div className="mx-auto flex w-full max-w-2xl flex-col">
			<Frame spacing="xs">
				<FramePanel className="p-0!">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>User</TableHead>
								<TableHead>Action</TableHead>
								<TableHead>Target</TableHead>
								<TableHead className="text-right">Time</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{activities.map((activity) => (
								<TableRow key={activity.id}>
									<TableCell>
										<div className="flex items-center gap-3">
											<Avatar size="sm">
												<AvatarImage src={activity.avatar} alt={activity.user} />
												<AvatarFallback>
													{activity.user
														.split(" ")
														.map((part) => part.charAt(0))
														.join("")}
												</AvatarFallback>
											</Avatar>
											<span className="text-sm font-medium">{activity.user}</span>
										</div>
									</TableCell>
									<TableCell>
										<Badge variant={activity.badge} size="sm">
											{activity.action}
										</Badge>
									</TableCell>
									<TableCell className="font-mono text-sm">{activity.target}</TableCell>
									<TableCell className="text-right text-sm text-muted-foreground">{activity.timestamp}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</FramePanel>
			</Frame>
		</div>
	);
}
