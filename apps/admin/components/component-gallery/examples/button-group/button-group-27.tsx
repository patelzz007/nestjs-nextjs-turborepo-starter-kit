import type * as React from "react";
import { cn } from "@workspace/ui/lib/core/utils";
import { ButtonGroup } from "@workspace/ui/components/button-group";
import { Input } from "@workspace/ui/components/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";

interface Status {
	readonly value: string;
	readonly label: string;
	readonly color: string;
}

const statuses: readonly Status[] = [
	{ value: "in-progress", label: "In Progress", color: "bg-tone-violet" },
	{ value: "completed", label: "Completed", color: "bg-success" },
	{ value: "pending", label: "Pending", color: "bg-primary" },
	{ value: "cancelled", label: "Cancelled", color: "bg-warning" },
	{ value: "rejected", label: "Rejected", color: "bg-destructive" },
];

const DEFAULT_STATUS = "completed";

interface StatusLabelProps {
	readonly status: Status;
}

function StatusLabel({ status }: StatusLabelProps): React.JSX.Element {
	return (
		<span className="flex items-center gap-2">
			<span className={cn("size-1.5 rounded-full", status.color)} />
			<span>{status.label}</span>
		</span>
	);
}

function formatStatus(value: string): React.ReactNode {
	const status = statuses.find((item) => item.value === value);
	return status === undefined ? value : <StatusLabel status={status} />;
}

export function ButtonGroup27Example(): React.JSX.Element {
	return (
		<ButtonGroup className="max-w-xs">
			<Select defaultValue={DEFAULT_STATUS} items={statuses}>
				<SelectTrigger className="min-w-36">
					<SelectValue formatValue={formatStatus} />
				</SelectTrigger>
				<SelectContent alignItemWithTrigger={false}>
					<SelectGroup>
						{statuses.map((status) => (
							<SelectItem key={status.value} value={status.value}>
								<StatusLabel status={status} />
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
			<Input placeholder="Search tasks..." aria-label="Search tasks" />
		</ButtonGroup>
	);
}
