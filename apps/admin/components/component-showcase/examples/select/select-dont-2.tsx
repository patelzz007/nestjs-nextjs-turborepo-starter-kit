import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";

interface SelectOption {
	readonly label: string;
	readonly value: string | null;
}

const COUNTRIES: readonly SelectOption[] = [
	"Argentina",
	"Australia",
	"Austria",
	"Belgium",
	"Brazil",
	"Canada",
	"Chile",
	"China",
	"Denmark",
	"Egypt",
	"Finland",
	"France",
	"Germany",
	"India",
	"Japan",
	"Malaysia",
].map((country: string): SelectOption => ({ label: country, value: country }));

export function SelectDont2Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="select-dont-2">Country</FieldLabel>
			<Select items={COUNTRIES}>
				<SelectTrigger id="select-dont-2">
					<SelectValue />
				</SelectTrigger>
				<SelectContent alignItemWithTrigger={false}>
					<SelectGroup>
						{COUNTRIES.map((item: SelectOption): React.JSX.Element => (
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
