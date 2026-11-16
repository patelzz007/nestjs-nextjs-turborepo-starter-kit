import { createFilterQuery, createFilterRule, type FilterQuery } from "@workspace/ui-kit-logic";
import { Avatar } from "@workspace/ui-native/components/avatar";
import { Button } from "@workspace/ui-native/components/button";
import { Filters } from "@workspace/ui-native/components/filters";
import type { FilterBarField, FilterBarOption } from "@workspace/ui-native/lib/filters";
import * as React from "react";
import { View } from "react-native";

/** The directory a server would page through. */
const CONTACTS: readonly { readonly id: string; readonly name: string }[] = Array.from({ length: 40 }, (_, index: number) => ({
	id: `c${String(index + 1)}`,
	name: `Contact ${String(index + 1)}`,
}));
const PAGE = 8;
const LATENCY_MS = 300;

function asOption(contact: { readonly id: string; readonly name: string }): FilterBarOption {
	return { value: contact.id, label: contact.name, leading: <Avatar name={contact.name} imageUrl={null} size="sm" /> };
}

/** A search a server answers a page at a time. */
function searchContacts(query: string): Promise<readonly FilterBarOption[]> {
	return new Promise((resolve: (options: readonly FilterBarOption[]) => void): void => {
		setTimeout((): void => {
			resolve(
				CONTACTS.filter((contact): boolean => contact.name.toLowerCase().includes(query.toLowerCase()))
					.slice(0, PAGE)
					.map(asOption),
			);
		}, LATENCY_MS);
	});
}

/** Names for ids no search has loaded yet. */
function nameContacts(ids: readonly string[]): Promise<readonly FilterBarOption[]> {
	return Promise.resolve(CONTACTS.filter((contact): boolean => ids.includes(contact.id)).map(asOption));
}

const FIELDS: readonly FilterBarField[] = [{ id: "contact", label: "Contact", type: "multiselect", loadOptions: searchContacts, resolveValues: nameContacts }];

/** A saved view: bare ids, as a server stores them. */
const SAVED: FilterQuery = createFilterQuery([createFilterRule({ id: "saved", path: ["contact"], operator: "has_any_of", value: ["c27", "c38"] })]);

// Options fetched as you search, a saved view restored by its ids (named once the server answers), and a reset.
export function Filters4Example(): React.JSX.Element {
	const [query, setQuery] = React.useState<FilterQuery>(createFilterQuery());
	const restore = React.useCallback((): void => {
		setQuery(SAVED);
	}, []);
	const reset = React.useCallback((): void => {
		setQuery(createFilterQuery());
	}, []);
	return (
		<View className="w-full gap-3">
			<View className="flex-row gap-2">
				<Button label="Restore saved view" variant="outline" size="sm" onPress={restore} />
				<Button label="Reset" variant="ghost" size="sm" onPress={reset} />
			</View>
			<Filters fields={FIELDS} query={query} onQueryChange={setQuery} />
		</View>
	);
}
