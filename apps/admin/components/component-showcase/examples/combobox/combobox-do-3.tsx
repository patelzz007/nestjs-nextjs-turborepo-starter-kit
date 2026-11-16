"use client";

import * as React from "react";
import {
	Combobox,
	ComboboxChip,
	ComboboxChips,
	ComboboxChipsInput,
	ComboboxCollection,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxItem,
	ComboboxList,
	useComboboxAnchor,
} from "@workspace/ui/components/combobox";
import { Field, FieldLabel } from "@workspace/ui/components/field";

const PEOPLE: readonly string[] = ["Ada Lovelace", "Alan Turing", "Grace Hopper", "Katherine Johnson", "Linus Torvalds", "Margaret Hamilton", "Tim Berners-Lee"];

function renderPerson(value: string): React.JSX.Element {
	return (
		<ComboboxItem key={value} value={value}>
			{value}
		</ComboboxItem>
	);
}

const INITIAL_PICKS: string[] = ["Ada Lovelace", "Grace Hopper", "Alan Turing"];

export function ComboboxDo3Example(): React.JSX.Element {
	const anchor = useComboboxAnchor();
	const [people, setPeople] = React.useState<string[]>(INITIAL_PICKS);
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel>Reviewers</FieldLabel>
			<Combobox multiple items={PEOPLE} value={people} onValueChange={setPeople}>
				<ComboboxChips ref={anchor}>
					{people.map((person: string): React.JSX.Element => (
						<ComboboxChip key={person}>{person}</ComboboxChip>
					))}
					<ComboboxChipsInput placeholder="Add a reviewer" aria-label="Reviewers" />
				</ComboboxChips>
				<ComboboxContent anchor={anchor}>
					<ComboboxEmpty text="No one by that name." />
					<ComboboxList>
						<ComboboxCollection>{renderPerson}</ComboboxCollection>
					</ComboboxList>
				</ComboboxContent>
			</Combobox>
		</Field>
	);
}
