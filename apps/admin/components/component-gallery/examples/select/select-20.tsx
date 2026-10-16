import * as React from "react";
import { Field } from "@workspace/ui/components/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";

const items = [
	{ label: "Select an option", value: null },
	{ label: "Option 1", value: "1" },
	{ label: "Option 2", value: "2" },
	{ label: "Option 3", value: "3" },
];

export function Select20Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<Select items={items}>
				<SelectTrigger>
					<SelectValue />
				</SelectTrigger>
				<SelectContent alignItemWithTrigger={false}>
					<SelectGroup>
						{items.slice(1).map((item) => (
							<SelectItem key={item.value} value={item.value} className="pr-2! pl-8 [&>span:last-child]:right-auto [&>span:last-child]:left-2">
								{item.label}
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
		</Field>
	);
}
