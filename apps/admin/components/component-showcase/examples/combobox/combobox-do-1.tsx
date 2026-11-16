import * as React from "react";
import { Combobox, ComboboxCollection, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@workspace/ui/components/combobox";
import { Field, FieldLabel } from "@workspace/ui/components/field";

const PEOPLE: readonly string[] = ["Ada Lovelace", "Alan Turing", "Grace Hopper", "Katherine Johnson", "Linus Torvalds", "Margaret Hamilton", "Tim Berners-Lee"];

function renderPerson(value: string): React.JSX.Element {
	return (
		<ComboboxItem key={value} value={value}>
			{value}
		</ComboboxItem>
	);
}

export function ComboboxDo1Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="combobox-do-1">Assignee</FieldLabel>
			<Combobox items={PEOPLE}>
				<ComboboxInput id="combobox-do-1" placeholder="Search" />
				<ComboboxContent>
					<ComboboxEmpty text="No one by that name." />
					<ComboboxList>
						<ComboboxCollection>{renderPerson}</ComboboxCollection>
					</ComboboxList>
				</ComboboxContent>
			</Combobox>
		</Field>
	);
}
