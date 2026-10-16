import * as React from "react";
import { CheckIcon, XIcon } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";
import { Timeline, TimelineContent, TimelineDate, TimelineHeader, TimelineIndicator, TimelineItem, TimelineSeparator, TimelineTitle } from "@workspace/ui/components/timeline";

import { cn } from "@workspace/ui/lib/core/utils";

const deployments = [
	{
		id: 1,
		title: "Production Deploy",
		date: "2 minutes ago",
		commit: "a1b2c3d",
		branch: "main",
		status: "success",
		duration: "42s",
	},
	{
		id: 2,
		title: "Staging Deploy",
		date: "15 minutes ago",
		commit: "e4f5g6h",
		branch: "staging",
		status: "success",
		duration: "38s",
	},
	{
		id: 3,
		title: "Preview Deploy",
		date: "1 hour ago",
		commit: "i7j8k9l",
		branch: "feat/auth",
		status: "failed",
		duration: "1m 12s",
	},
	{
		id: 4,
		title: "Production Deploy",
		date: "3 hours ago",
		commit: "m0n1o2p",
		branch: "main",
		status: "success",
		duration: "45s",
	},
];

export function Timeline10Example(): React.JSX.Element {
	return (
		<div className="w-full max-w-xs">
			<Timeline defaultValue={4}>
				{deployments.map((deploy) => (
					<TimelineItem key={deploy.id} step={deploy.id} className="group-data-[orientation=vertical]/timeline:ms-10">
						<TimelineHeader>
							<TimelineSeparator className="bg-input! group-data-[orientation=vertical]/timeline:-left-7 group-data-[orientation=vertical]/timeline:h-[calc(100%-1.5rem-0.25rem)] group-data-[orientation=vertical]/timeline:translate-y-6.5" />
							<div className="flex items-center gap-2">
								<TimelineTitle className="text-sm">{deploy.title}</TimelineTitle>
								<Badge variant={deploy.status === "success" ? "success-light" : "destructive-light"} size="sm">
									{deploy.status}
								</Badge>
							</div>
							<TimelineIndicator
								className={cn(
									"flex size-6 items-center justify-center border-none group-data-[orientation=vertical]/timeline:-left-7",
									deploy.status === "success" ? "bg-success text-status-foreground" : "bg-destructive text-status-foreground",
								)}>
								{deploy.status === "success" ? <CheckIcon className="size-3.5" /> : <XIcon className="size-3.5" />}
							</TimelineIndicator>
						</TimelineHeader>
						<TimelineContent>
							<div className="flex items-center gap-3 text-xs text-muted-foreground">
								<span className="font-mono">{deploy.commit}</span>
								<span>&middot;</span>
								<span>{deploy.branch}</span>
								<span>&middot;</span>
								<span>{deploy.duration}</span>
							</div>
							<TimelineDate className="mt-1 mb-0">{deploy.date}</TimelineDate>
						</TimelineContent>
					</TimelineItem>
				))}
			</Timeline>
		</div>
	);
}
