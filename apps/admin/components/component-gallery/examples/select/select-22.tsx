"use client";

import type * as React from "react";
import { ChevronsUpDownIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { Field } from "@workspace/ui/components/field";
import { Select, SelectClear, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";

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
];

export function Select22Example(): React.JSX.Element {
	const [value, setValue] = useState<string | null>(null);

	const handleValueChange = useCallback((next: string | null): void => {
		setValue(next);
	}, []);
	const handleClear = useCallback((): void => {
		setValue(null);
	}, []);

	return (
		<Field className="max-w-xs">
			<Select value={value} onValueChange={handleValueChange} items={items}>
				<SelectTrigger className="w-[200px] [&>svg:last-child]:hidden!">
					<SelectValue placeholder="Select an option" />
					{value === null ? <ChevronsUpDownIcon className="size-4 text-muted-foreground" /> : <SelectClear onClear={handleClear} />}
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
