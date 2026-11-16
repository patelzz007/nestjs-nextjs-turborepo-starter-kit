"use client";

import type * as React from "react";
import { useCallback, useState } from "react";
import { Field } from "@workspace/ui/components/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";

interface Fruit {
	readonly label: string;
	readonly value: string;
}

const items: readonly Fruit[] = [
	{ label: "Apple", value: "apple" },
	{ label: "Banana", value: "banana" },
	{ label: "Blueberry", value: "blueberry" },
	{ label: "Grapes", value: "grapes" },
	{ label: "Pineapple", value: "pineapple" },
	{ label: "Strawberry", value: "strawberry" },
	{ label: "Watermelon", value: "watermelon" },
];

const NO_FRUITS: string[] = [];

/** The trigger's summary of a multi-selection: a prompt, the one label, or a count. */
function describeFruits(values: readonly string[]): string {
	const [first, ...rest] = values;
	if (first === undefined) {
		return "Select fruits";
	}
	if (rest.length === 0) {
		return items.find((item) => item.value === first)?.label ?? first;
	}
	return `${String(values.length)} fruits selected`;
}

export function Select12Example(): React.JSX.Element {
	const [selected, setSelected] = useState<string[]>(NO_FRUITS);
	const handleValueChange = useCallback((values: string[]): void => {
		setSelected(values);
	}, []);

	return (
		<Field className="max-w-xs">
			<Select items={items} multiple value={selected} onValueChange={handleValueChange}>
				<SelectTrigger className="w-full">
					<SelectValue>{describeFruits(selected)}</SelectValue>
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
		</Field>
	);
}
