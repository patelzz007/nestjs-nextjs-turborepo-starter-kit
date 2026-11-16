import type * as React from "react";
import { cn } from "@workspace/ui/lib/core/utils";
import { Field } from "@workspace/ui/components/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";

interface Status {
	readonly value: string;
	readonly label: string;
	/** The dot's colour; `undefined` for the "all" option, which shows no dot. */
	readonly color: string | undefined;
}

const statuses: readonly Status[] = [
	{ value: "all", label: "All Status", color: undefined },
	{ value: "active", label: "Active", color: "bg-success" },
	{ value: "inactive", label: "Inactive", color: "bg-destructive" },
	{ value: "pending", label: "Pending", color: "bg-warning" },
	{ value: "archived", label: "Archived", color: "bg-muted-foreground" },
];

const DEFAULT_STATUS = "all";

interface StatusLabelProps {
	readonly status: Status;
}

function StatusLabel({ status }: StatusLabelProps): React.JSX.Element {
	return (
		<span className="flex items-center gap-2">
			{status.color === undefined ? null : <span className={cn("size-2 shrink-0 rounded-full", status.color)} />}
			<span>{status.label}</span>
		</span>
	);
}

function formatStatus(value: string): React.ReactNode {
	const status = statuses.find((item) => item.value === value);
	return status === undefined ? value : <StatusLabel status={status} />;
}

export function Select26Example(): React.JSX.Element {
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
