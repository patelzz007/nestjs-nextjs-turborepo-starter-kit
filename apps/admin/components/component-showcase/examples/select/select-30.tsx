import type * as React from "react";
import { Badge, type BadgeProps } from "@workspace/ui/components/badge";

import { Field } from "@workspace/ui/components/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";

interface Priority {
	readonly value: string;
	readonly label: string;
	readonly variant: BadgeProps["variant"];
}

const priorities: readonly Priority[] = [
	{ value: "none", label: "No Priority", variant: "outline" },
	{ value: "urgent", label: "Urgent", variant: "destructive" },
	{ value: "high", label: "High", variant: "warning" },
	{ value: "medium", label: "Medium", variant: "warning-light" },
	{ value: "low", label: "Low", variant: "info" },
];

const DEFAULT_PRIORITY = "none";

interface PriorityBadgeProps {
	readonly priority: Priority;
}

function PriorityBadge({ priority }: PriorityBadgeProps): React.JSX.Element {
	return (
		<span className="flex items-center gap-2">
			<Badge variant={priority.variant} size="sm">
				{priority.label}
			</Badge>
		</span>
	);
}

function formatPriority(value: string): React.ReactNode {
	const priority = priorities.find((item) => item.value === value);
	return priority === undefined ? value : <PriorityBadge priority={priority} />;
}

export function Select30Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<Select defaultValue={DEFAULT_PRIORITY} items={priorities}>
				<SelectTrigger className="w-[200px]">
					<SelectValue formatValue={formatPriority} />
				</SelectTrigger>
				<SelectContent alignItemWithTrigger={false}>
					<SelectGroup>
						{priorities.map((priority) => (
							<SelectItem key={priority.value} value={priority.value}>
								<PriorityBadge priority={priority} />
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
		</Field>
	);
}
