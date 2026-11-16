import type * as React from "react";
import { Field } from "@workspace/ui/components/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";

interface AccessLevel {
	readonly value: string;
	readonly label: string;
	readonly description: string;
}

const accessLevels: readonly AccessLevel[] = [
	{ value: "full_access", label: "Full access", description: "Can modify list access" },
	{ value: "read_write", label: "Read and write", description: "Can edit & publish lists" },
	{ value: "read_only", label: "Read only", description: "Can only view lists" },
	{ value: "no_access", label: "No access", description: "Cannot view or edit lists" },
];

const DEFAULT_ACCESS_LEVEL = "read_write";

export function Select16Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<Select defaultValue={DEFAULT_ACCESS_LEVEL} items={accessLevels}>
				<SelectTrigger className="w-[240px] [&_small]:hidden">
					<SelectValue />
				</SelectTrigger>
				<SelectContent alignItemWithTrigger={false}>
					<SelectGroup>
						{accessLevels.map((level) => (
							<SelectItem key={level.value} value={level.value} className="[&_svg]:text-primary">
								<span className="flex flex-col items-start gap-px">
									<span className="font-medium">{level.label}</span>
									<small className="text-xs text-muted-foreground">{level.description}</small>
								</span>
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
		</Field>
	);
}
