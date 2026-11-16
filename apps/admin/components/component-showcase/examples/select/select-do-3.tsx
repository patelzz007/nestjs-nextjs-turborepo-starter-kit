import * as React from "react";
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";

interface SelectOption {
	readonly label: string;
	readonly value: string | null;
}

const TIMEZONES: readonly SelectOption[] = [
	{ label: "Choose a time zone", value: null },
	{ label: "London (GMT)", value: "Europe/London" },
	{ label: "Paris (CET)", value: "Europe/Paris" },
	{ label: "Dubai (GST)", value: "Asia/Dubai" },
	{ label: "Kuala Lumpur (MYT)", value: "Asia/Kuala_Lumpur" },
	{ label: "Tokyo (JST)", value: "Asia/Tokyo" },
	{ label: "Sydney (AEST)", value: "Australia/Sydney" },
];

export function SelectDo3Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="select-do-3">Time zone</FieldLabel>
			<Select items={TIMEZONES}>
				<SelectTrigger id="select-do-3" aria-invalid aria-describedby="select-do-3-error">
					<SelectValue />
				</SelectTrigger>
				<SelectContent alignItemWithTrigger={false}>
					<SelectGroup>
						{TIMEZONES.map((item: SelectOption): React.JSX.Element => (
							<SelectItem key={item.label} value={item.value}>
								{item.label}
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
			<FieldError id="select-do-3-error">Choose the time zone your team works in.</FieldError>
		</Field>
	);
}
