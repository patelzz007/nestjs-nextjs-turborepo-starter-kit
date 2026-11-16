import type { FilterValue } from "@workspace/ui-kit-logic";
import { filterValueItems } from "@workspace/ui-kit-logic";
import type { FilterBarField } from "@workspace/ui-native/lib/filters";
import * as React from "react";

import { FilterBar, PRIORITIES, scalarText, STATUSES } from "./filters-sample";

/** How many picks a chip names before it counts them. */
const NAMED = 2;

/** Picks read as their names, folding to a count past two. */
function pickedText(options: typeof STATUSES): (value: FilterValue) => string {
	return (value: FilterValue): string => {
		const labels = filterValueItems(value).map((item) => options.find((option) => option.value === scalarText(item))?.label ?? scalarText(item));
		return labels.length > NAMED ? `${labels.slice(0, NAMED).join(", ")} +${String(labels.length - NAMED)}` : labels.join(", ");
	};
}

const FIELDS: readonly FilterBarField[] = [
	{ id: "status", label: "Status", type: "multiselect", options: STATUSES, valueText: pickedText(STATUSES) },
	{ id: "priority", label: "Priority", type: "multiselect", options: PRIORITIES, valueText: pickedText(PRIORITIES) },
	// A condition that takes no value: "Flagged is empty / is not empty".
	{
		id: "flagged",
		label: "Flagged",
		type: "text",
		operators: [
			{ value: "not_empty", label: "is set", arity: "none" },
			{ value: "empty", label: "is not set", arity: "none" },
		],
	},
];

// Colour dots on every status and priority, picks folding to "+n" past two, and a chip with no value.
export function Filters3Example(): React.JSX.Element {
	return <FilterBar fields={FIELDS} />;
}
