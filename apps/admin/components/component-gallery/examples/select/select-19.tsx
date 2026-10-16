import type * as React from "react";
import { Badge, type BadgeProps } from "@workspace/ui/components/badge";

import { Field } from "@workspace/ui/components/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";

interface Status {
	readonly value: string;
	readonly label: string;
	readonly variant: BadgeProps["variant"];
}

const statuses: readonly Status[] = [
	{ value: "in-progress", label: "In Progress", variant: "warning-outline" },
	{ value: "completed", label: "Completed", variant: "success-outline" },
	{ value: "pending", label: "Pending", variant: "info-outline" },
	{ value: "cancelled", label: "Cancelled", variant: "primary-outline" },
	{ value: "rejected", label: "Rejected", variant: "destructive-outline" },
];

const DEFAULT_STATUS = "pending";

function formatStatus(value: string): React.ReactNode {
	const status = statuses.find((item) => item.value === value);
	return status === undefined ? value : <Badge variant={status.variant}>{status.label}</Badge>;
}

export function Select19Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<Select defaultValue={DEFAULT_STATUS} items={statuses}>
				<SelectTrigger className="w-[200px]">
					<span className="flex items-center gap-2">
						Status:
						<SelectValue formatValue={formatStatus} />
					</span>
				</SelectTrigger>
				<SelectContent alignItemWithTrigger={false}>
					{statuses.map((status) => (
						<SelectItem key={status.value} value={status.value}>
							<Badge variant={status.variant}>{status.label}</Badge>
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</Field>
	);
}
