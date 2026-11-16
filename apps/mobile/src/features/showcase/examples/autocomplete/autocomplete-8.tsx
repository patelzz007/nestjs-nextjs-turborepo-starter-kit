import { Autocomplete, type AutocompleteItem } from "@workspace/ui-native/components/autocomplete";
import * as React from "react";

const PEOPLE: readonly AutocompleteItem[] = [
	{ value: "Avery Chen", description: "Staff engineer", group: "Engineering" },
	{ value: "Jordan Lee", description: "Frontend engineer", group: "Engineering" },
	{ value: "Sam Patel", description: "Product designer", group: "Design" },
	{ value: "Riley Tan", description: "Brand designer", group: "Design" },
	{ value: "Morgan Lim", description: "Account executive", group: "Sales" },
];

export function Autocomplete8Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return <Autocomplete value={value} onChange={setValue} items={PEOPLE} placeholder="Search people…" accessibilityLabel="Person" />;
}
