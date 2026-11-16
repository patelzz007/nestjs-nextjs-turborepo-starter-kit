import type * as React from "react";
import { cn } from "@workspace/ui/lib/core/utils";
import { Field } from "@workspace/ui/components/field";
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

function StatusLabel({ status }: { readonly status: Status }): React.JSX.Element {
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

export function Select17Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<Select defaultValue={DEFAULT_STATUS} items={statuses}>
				<SelectTrigger>
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
		</Field>
	);
}
