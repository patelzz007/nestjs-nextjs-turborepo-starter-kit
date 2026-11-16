import * as React from "react";
import { Input } from "@workspace/ui/components/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";

const filterItems = [
	{ label: "Filter", value: null },
	{ label: "All", value: "all" },
	{ label: "Active", value: "active" },
	{ label: "Inactive", value: "inactive" },
];

export function Select13Example(): React.JSX.Element {
	return (
		<div className="flex w-full max-w-xs items-center gap-2">
			<Input placeholder="Search..." className="flex-1" />
			<Select items={filterItems}>
				<SelectTrigger className="w-[140px]">
					<SelectValue />
				</SelectTrigger>
				<SelectContent alignItemWithTrigger={false}>
					<SelectGroup>
						{filterItems.map((item) => (
							<SelectItem key={item.value} value={item.value}>
								{item.label}
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
		</div>
	);
}
