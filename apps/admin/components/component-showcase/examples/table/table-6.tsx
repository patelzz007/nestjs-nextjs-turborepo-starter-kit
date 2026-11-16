import * as React from "react";
import { Badge, type BadgeVariant } from "@workspace/ui/components/badge";
import { Frame, FramePanel } from "@workspace/ui/components/frame";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";

interface Member {
	readonly name: string;
	readonly email: string;
	readonly avatar: string;
	readonly role: string;
	readonly roleVariant: BadgeVariant;
	readonly status: string;
	readonly statusVariant: BadgeVariant;
}

const members: readonly Member[] = [
	{
		name: "Sarah Chen",
		email: "sarah@example.com",
		avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&dpr=2&q=80",
		role: "Admin",
		roleVariant: "default",
		status: "Active",
		statusVariant: "success-light",
	},
	{
		name: "Marcus Johnson",
		email: "marcus@example.com",
		avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80",
		role: "Developer",
		roleVariant: "info-light",
		status: "Active",
		statusVariant: "success-light",
	},
	{
		name: "Emily Park",
		email: "emily@example.com",
		avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=96&h=96&dpr=2&q=80",
		role: "Designer",
		roleVariant: "warning-light",
		status: "Away",
		statusVariant: "warning-light",
	},
	{
		name: "David Kim",
		email: "david@example.com",
		avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=96&h=96&dpr=2&q=80",
		role: "Viewer",
		roleVariant: "outline",
		status: "Offline",
		statusVariant: "outline",
	},
];

export function Table6Example(): React.JSX.Element {
	return (
		<div className="mx-auto flex w-full max-w-2xl flex-col">
			<Frame spacing="xs">
				<FramePanel className="p-0!">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Member</TableHead>
								<TableHead>Role</TableHead>
								<TableHead>Status</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{members.map((member) => (
								<TableRow key={member.email}>
									<TableCell>
										<div className="flex items-center gap-3">
											<Avatar size="sm">
												<AvatarImage src={member.avatar} alt={member.name} />
												<AvatarFallback>
													{member.name
														.split(" ")
														.map((part) => part.charAt(0))
														.join("")}
												</AvatarFallback>
											</Avatar>
											<div className="flex flex-col">
												<span className="text-sm font-medium">{member.name}</span>
												<span className="text-xs text-muted-foreground">{member.email}</span>
											</div>
										</div>
									</TableCell>
									<TableCell>
										<Badge variant={member.roleVariant} size="sm">
											{member.role}
										</Badge>
									</TableCell>
									<TableCell>
										<Badge variant={member.statusVariant} size="sm">
											{member.status}
										</Badge>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</FramePanel>
			</Frame>
		</div>
	);
}
