import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";

const items = [
	{ label: "Select a fruit", value: null },
	{ label: "Apple", value: "apple" },
	{ label: "Banana", value: "banana" },
	{ label: "Blueberry", value: "blueberry" },
];

export function Select14Example(): React.JSX.Element {
	return (
		<div className="flex w-full max-w-xs items-center gap-2">
			<Select items={items}>
				<SelectTrigger className="grow">
					<SelectValue />
				</SelectTrigger>
				<SelectContent alignItemWithTrigger={false}>
					<SelectGroup>
						{items.map((item) => (
							<SelectItem key={item.value} value={item.value}>
								{item.label}
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
			<Button>Submit</Button>
		</div>
	);
}
