import * as React from "react";
import { GitCompareArrowsIcon, GitForkIcon, GitMergeIcon, GitPullRequestArrowIcon } from "lucide-react";
import { Timeline, TimelineContent, TimelineDate, TimelineHeader, TimelineIndicator, TimelineItem, TimelineSeparator, TimelineTitle } from "@workspace/ui/components/timeline";

const gitActivity = [
	{
		id: 1,
		date: "15 minutes ago",
		title: "Forked Repository",
		description: "Forked the repository to create a new branch for development.",
		icon: <GitForkIcon className="size-4" />,
	},
	{
		id: 2,
		date: "10 minutes ago",
		title: "Pull Request Submitted",
		description: "Submitted PR #342 with new feature implementation. Waiting for code review.",
		icon: <GitPullRequestArrowIcon className="size-3.5" />,
	},
	{
		id: 3,
		date: "5 minutes ago",
		title: "Comparing Branches",
		description: "Received comments on PR. Minor adjustments needed in error handling.",
		icon: <GitCompareArrowsIcon className="size-3.5" />,
	},
	{
		id: 4,
		date: "Just now",
		title: "Merged Branch",
		description: "Merged the feature branch into the main branch. Ready for deployment.",
		icon: <GitMergeIcon className="size-3.5" />,
	},
];

export function Timeline4Example(): React.JSX.Element {
	return (
		<Timeline defaultValue={3} className="w-full max-w-md">
			{gitActivity.map((item) => (
				<TimelineItem key={item.id} step={item.id} className="group-data-[orientation=vertical]/timeline:ms-10">
					<TimelineHeader>
						<TimelineSeparator className="group-data-[orientation=vertical]/timeline:-left-7 group-data-[orientation=vertical]/timeline:h-[calc(100%-1.5rem-0.25rem)] group-data-[orientation=vertical]/timeline:translate-y-6.5" />
						<TimelineTitle className="mt-0.5">{item.title}</TimelineTitle>
						<TimelineIndicator className="flex size-6 items-center justify-center border-none bg-primary/10 group-data-completed/timeline-item:bg-primary group-data-completed/timeline-item:text-primary-foreground group-data-[orientation=vertical]/timeline:-left-7">
							{item.icon}
						</TimelineIndicator>
					</TimelineHeader>
					<TimelineContent>
						{item.description}
						<TimelineDate className="mt-2 mb-0">{item.date}</TimelineDate>
					</TimelineContent>
				</TimelineItem>
			))}
		</Timeline>
	);
}
