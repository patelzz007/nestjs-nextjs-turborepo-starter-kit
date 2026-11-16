import * as React from "react";
import { Field } from "@workspace/ui/components/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@workspace/ui/components/select";

const fruits = [
	{ label: "Apple", value: "apple" },
	{ label: "Banana", value: "banana" },
	{ label: "Blueberry", value: "blueberry" },
];

const vegetables = [
	{ label: "Carrot", value: "carrot" },
	{ label: "Broccoli", value: "broccoli" },
	{ label: "Spinach", value: "spinach" },
];

const allItems = [{ label: "Select an option", value: null }, ...fruits, ...vegetables];

export function Select3Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<Select items={allItems}>
				<SelectTrigger>
					<SelectValue />
				</SelectTrigger>
				<SelectContent alignItemWithTrigger={false}>
					<SelectGroup>
						<SelectLabel>Fruits</SelectLabel>
						{fruits.map((item) => (
							<SelectItem key={item.value} value={item.value}>
								{item.label}
							</SelectItem>
						))}
					</SelectGroup>
					<SelectSeparator />
					<SelectGroup>
						<SelectLabel>Vegetables</SelectLabel>
						{vegetables.map((item) => (
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
