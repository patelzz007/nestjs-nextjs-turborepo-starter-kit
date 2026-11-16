import * as React from "react";
import { ArrowDownIcon, ArrowRightIcon, ArrowUpIcon } from "lucide-react";
import { Badge, type BadgeVariant } from "@workspace/ui/components/badge";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";

interface Issue {
	readonly id: string;
	readonly title: string;
	readonly priority: string;
	readonly priorityVariant: BadgeVariant;
	readonly priorityIcon: React.ReactNode;
	readonly label: string;
	readonly labelVariant: BadgeVariant;
	readonly assignee: string;
	readonly assigneeAvatar: string;
	readonly status: string;
	readonly statusVariant: BadgeVariant;
}

const issues: readonly Issue[] = [
	{
		id: "ISS-421",
		title: "Login page returns 500 on mobile",
		priority: "Critical",
		priorityVariant: "destructive",
		priorityIcon: <ArrowUpIcon className="size-3" aria-hidden="true" />,
		label: "Bug",
		labelVariant: "destructive-light",
		assignee: "Sarah Chen",
		assigneeAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&dpr=2&q=80",
		status: "Open",
		statusVariant: "info-light",
	},
	{
		id: "ISS-420",
		title: "Add dark mode support",
		priority: "High",
		priorityVariant: "warning",
		priorityIcon: <ArrowUpIcon className="size-3" aria-hidden="true" />,
		label: "Feature",
		labelVariant: "info-light",
		assignee: "Marcus Johnson",
		assigneeAvatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80",
		status: "In Progress",
		statusVariant: "warning-light",
	},
	{
		id: "ISS-419",
		title: "Update user onboarding flow",
		priority: "Medium",
		priorityVariant: "info",
		priorityIcon: <ArrowRightIcon className="size-3" aria-hidden="true" />,
		label: "Improvement",
		labelVariant: "success-light",
		assignee: "Emily Park",
		assigneeAvatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=96&h=96&dpr=2&q=80",
		status: "In Review",
		statusVariant: "info-light",
	},
	{
		id: "ISS-418",
		title: "Refactor API rate limiter module",
		priority: "Low",
		priorityVariant: "secondary",
		priorityIcon: <ArrowDownIcon className="size-3" aria-hidden="true" />,
		label: "Tech Debt",
		labelVariant: "outline",
		assignee: "David Kim",
		assigneeAvatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=96&h=96&dpr=2&q=80",
		status: "Closed",
		statusVariant: "success-light",
	},
];

export function Table14Example(): React.JSX.Element {
	return (
		<div className="mx-auto flex w-full max-w-2xl flex-col">
			<Card className="p-0">
				<CardContent className="overflow-x-auto p-0">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-20">ID</TableHead>
								<TableHead>Issue</TableHead>
								<TableHead>Assignee</TableHead>
								<TableHead>Status</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{issues.map((issue) => (
								<TableRow key={issue.id}>
									<TableCell className="font-mono text-xs text-muted-foreground">{issue.id}</TableCell>
									<TableCell>
										<div className="flex items-center gap-2">
											<span className="truncate text-sm font-medium">{issue.title}</span>
											<Badge variant="outline" size="xs">
												{issue.label}
											</Badge>
										</div>
									</TableCell>
									<TableCell>
										<div className="flex items-center gap-2">
											<Avatar size="sm">
												<AvatarImage src={issue.assigneeAvatar} alt={issue.assignee} />
												<AvatarFallback>
													{issue.assignee
														.split(" ")
														.map((part) => part.charAt(0))
														.join("")}
												</AvatarFallback>
											</Avatar>
											<span className="text-sm">{issue.assignee}</span>
										</div>
									</TableCell>
									<TableCell>
										<Badge variant={issue.statusVariant} size="sm">
											{issue.status}
										</Badge>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</div>
	);
}
