import {
	Combobox,
	ComboboxCollection,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxGroup,
	ComboboxInput,
	ComboboxItem,
	ComboboxLabel,
	ComboboxList,
} from "@workspace/ui/components/combobox";
import { Field } from "@workspace/ui/components/field";
import type * as React from "react";

interface TimezoneGroup {
	readonly value: string;
	readonly items: readonly string[];
}

const TIMEZONES: readonly TimezoneGroup[] = [
	{
		value: "Americas",
		items: ["(GMT-5) New York", "(GMT-8) Los Angeles", "(GMT-6) Chicago", "(GMT-5) Toronto", "(GMT-8) Vancouver", "(GMT-3) São Paulo"],
	},
	{
		value: "Europe",
		items: ["(GMT+0) London", "(GMT+1) Paris", "(GMT+1) Berlin", "(GMT+1) Rome", "(GMT+1) Madrid", "(GMT+1) Amsterdam"],
	},
	{
		value: "Asia/Pacific",
		items: ["(GMT+9) Tokyo", "(GMT+8) Shanghai", "(GMT+8) Singapore", "(GMT+4) Dubai", "(GMT+11) Sydney", "(GMT+9) Seoul"],
	},
];

function renderTimezoneItem(timezone: string): React.JSX.Element {
	return (
		<ComboboxItem key={timezone} value={timezone}>
			{timezone}
		</ComboboxItem>
	);
}

function renderTimezoneGroup(group: TimezoneGroup): React.JSX.Element {
	return (
		<ComboboxGroup key={group.value} items={group.items}>
			<ComboboxLabel>{group.value}</ComboboxLabel>
			<ComboboxCollection>{renderTimezoneItem}</ComboboxCollection>
		</ComboboxGroup>
	);
}

export function Combobox6Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<Combobox items={TIMEZONES}>
				<ComboboxInput placeholder="Select a timezone" />
				<ComboboxContent>
					<ComboboxEmpty text="No timezones found." />
					<ComboboxList>
						<ComboboxCollection>{renderTimezoneGroup}</ComboboxCollection>
					</ComboboxList>
				</ComboboxContent>
			</Combobox>
		</Field>
	);
}
