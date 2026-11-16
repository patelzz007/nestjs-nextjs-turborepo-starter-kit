import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";

interface SelectOption {
	readonly label: string;
	readonly value: string | null;
}

const YES_NO: readonly SelectOption[] = [
	{ label: "Yes", value: "yes" },
	{ label: "No", value: "no" },
];

export function SelectDont1Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="select-dont-1">Invoices by email</FieldLabel>
			<Select items={YES_NO}>
				<SelectTrigger id="select-dont-1">
					<SelectValue />
				</SelectTrigger>
				<SelectContent alignItemWithTrigger={false}>
					<SelectGroup>
						{YES_NO.map((item: SelectOption): React.JSX.Element => (
							<SelectItem key={item.label} value={item.value}>
								{item.label}
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
		</Field>
	);
}
