import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, type SelectOption } from "@workspace/ui/components/select";

const FORM_COUNTRY_OPTIONS: readonly SelectOption<string>[] = [
	{ value: "us", label: "United States" },
	{ value: "uk", label: "United Kingdom" },
	{ value: "ca", label: "Canada" },
];

export function Input15Example(): React.JSX.Element {
	return (
		<form className="w-full">
			<FieldGroup>
				<div className="grid grid-cols-2 gap-4">
					<Field>
						<FieldLabel htmlFor="form-phone">Phone</FieldLabel>
						<Input id="form-phone" type="tel" placeholder="+1 (555) 123-4567" />
					</Field>
					<Field>
						<FieldLabel htmlFor="form-country">Country</FieldLabel>
						<Select items={FORM_COUNTRY_OPTIONS} defaultValue="us">
							<SelectTrigger id="form-country">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{FORM_COUNTRY_OPTIONS.map((option: SelectOption<string>): React.JSX.Element => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
				</div>
				<Field>
					<FieldLabel htmlFor="form-address">Address</FieldLabel>
					<Input id="form-address" type="text" placeholder="123 Main St" />
				</Field>
				<div className="flex justify-end gap-3 pt-4">
					<Button type="button" variant="outline">
						Cancel
					</Button>
					<Button type="submit">Submit</Button>
				</div>
			</FieldGroup>
		</form>
	);
}
