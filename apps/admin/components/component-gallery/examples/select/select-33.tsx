import * as React from "react";
import { Field } from "@workspace/ui/components/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";

const sizes = [
	{ label: "Select a size", value: null },
	{ label: "Small", value: "sm" },
	{ label: "Medium", value: "md" },
	{ label: "Large", value: "lg" },
	{ label: "Extra Large", value: "xl" },
];

export function Select33Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<Select items={sizes}>
				<SelectTrigger size="sm">
					<SelectValue placeholder="Select a size" />
				</SelectTrigger>
				<SelectContent alignItemWithTrigger={false}>
					<SelectGroup>
						{sizes.map((size) => (
							<SelectItem key={size.value} value={size.value}>
								{size.label}
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
		</Field>
	);
}
