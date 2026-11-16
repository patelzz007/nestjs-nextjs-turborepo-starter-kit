import * as React from "react";
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";
import { Frame, FrameHeader, FramePanel } from "@workspace/ui/components/frame";
import { Timeline, TimelineContent, TimelineHeader, TimelineIndicator, TimelineItem, TimelineSeparator, TimelineTitle } from "@workspace/ui/components/timeline";

import { cn } from "@workspace/ui/lib/core/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@workspace/ui/components/collapsible";
import { Spinner } from "@workspace/ui/components/spinner";

interface PipelineStep {
	readonly id: number;
	readonly title: string;
	readonly duration: string;
	readonly status: StepStatus;
	readonly description: string;
	readonly user: { readonly name: string; readonly avatar: string };
}

const pipelineSteps: readonly PipelineStep[] = [
	{
		id: 1,
		title: "Source Code Checkout",
		duration: "12s",
		status: "completed",
		description: "Successfully fetched latest changes from the main branch.",
		user: {
			name: "Alex Johnson",
			avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80",
		},
	},
	{
		id: 2,
		title: "Dependency Installation",
		duration: "1m 45s",
		status: "completed",
		description: "All npm packages installed and cached for future builds.",
		user: {
			name: "Sarah Chen",
			avatar: "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80",
		},
	},
	{
		id: 3,
		title: "Unit & Integration Tests",
		duration: "Running",
		status: "active",
		description: "Running 142 test suites across the entire codebase...",
		user: {
			name: "Michael Rodriguez",
			avatar: "https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=96&h=96&dpr=2&q=80",
		},
	},
	{
		id: 4,
		title: "Production Build",
		duration: "Pending",
		status: "pending",
		description: "Optimizing assets and generating static site pages.",
		user: {
			name: "Emma Wilson",
			avatar: "https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=96&h=96&dpr=2&q=80",
		},
	},
];

type StepStatus = "completed" | "active" | "pending";

interface StatusIconProps {
	readonly status: StepStatus;
}

function StatusIcon({ status }: StatusIconProps): React.JSX.Element {
	if (status === "completed") return <CheckIcon className="size-3.5" />;
	if (status === "active") return <Spinner className="size-3.5" />;
	return <CircleIcon className="size-3.5" />;
}

interface StatusBadgeProps {
	readonly status: StepStatus;
	readonly duration: string;
}

/** Each step status as a light status badge. */
const STATUS_BADGE_VARIANT: Readonly<Record<StepStatus, "success-light" | "info-light" | "warning-light">> = {
	completed: "success-light",
	active: "info-light",
	pending: "warning-light",
};

function StatusBadge({ status, duration }: StatusBadgeProps): React.JSX.Element {
	const variant = STATUS_BADGE_VARIANT[status];

	return (
		<Badge variant={variant} size="sm">
			{duration}
		</Badge>
	);
}

export function Timeline6Example(): React.JSX.Element {
	return (
		<div className="w-full max-w-lg">
			<Timeline defaultValue={3}>
				{pipelineSteps.map((step) => (
					<TimelineItem key={step.id} step={step.id} className="ms-10 pb-10">
						<TimelineHeader>
							<TimelineSeparator className="group-data-[orientation=vertical]/timeline:-left-7 group-data-[orientation=vertical]/timeline:h-[calc(100%-1.5rem-0.25rem)] group-data-[orientation=vertical]/timeline:translate-y-7" />
							<div className="flex items-center gap-2">
								<TimelineTitle className="text-sm font-semibold">{step.title}</TimelineTitle>
								<StatusBadge status={step.status} duration={step.duration} />
							</div>
							<TimelineIndicator
								className={cn(
									"flex size-6 items-center justify-center border-none bg-muted text-muted-foreground group-data-completed/timeline-item:bg-primary group-data-completed/timeline-item:text-primary-foreground group-data-[orientation=vertical]/timeline:-left-7",
									step.status === "active" && "ring-2 ring-primary/20",
								)}>
								<StatusIcon status={step.status} />
							</TimelineIndicator>
						</TimelineHeader>
						<TimelineContent className="mt-2">
							<Frame stacked dense spacing="sm">
								<Collapsible defaultOpen className="group/collapsible">
									<CollapsibleTrigger className="flex w-full">
										<FrameHeader className="flex grow flex-row items-center justify-between gap-2">
											<div className="flex items-center gap-2">
												<Avatar className="size-5">
													<AvatarImage src={step.user.avatar} alt={step.user.name} />
													<AvatarFallback>{step.user.name.charAt(0)}</AvatarFallback>
												</Avatar>
												<span className="text-xs font-medium text-muted-foreground">{step.user.name}</span>
											</div>
											<ChevronRightIcon className="size-4 text-muted-foreground transition-transform duration-200 group-data-open/collapsible:rotate-90" />
										</FrameHeader>
									</CollapsibleTrigger>
									<CollapsibleContent>
										<FramePanel>
											<p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
										</FramePanel>
									</CollapsibleContent>
								</Collapsible>
							</Frame>
						</TimelineContent>
					</TimelineItem>
				))}
			</Timeline>
		</div>
	);
}
