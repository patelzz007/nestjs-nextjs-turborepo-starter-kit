import type * as React from "react";
import { Field } from "@workspace/ui/components/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";

/** How many options the long list holds, to show the scroll arrows. */
const ITEM_COUNT = 100;

interface Item {
	readonly label: string;
	readonly value: string;
}

const items: readonly Item[] = Array.from({ length: ITEM_COUNT }, (_, index): Item => ({
	label: `Item ${String(index)}`,
	value: `item-${String(index)}`,
}));

export function Select4Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<Select items={items}>
				<SelectTrigger>
					<SelectValue placeholder="Select an item" />
				</SelectTrigger>
				<SelectContent>
					<SelectGroup>
						{items.map((item) => (
							<SelectItem key={item.value} value={item.value}>
								{item.label}
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
		</Field>
	);
}
