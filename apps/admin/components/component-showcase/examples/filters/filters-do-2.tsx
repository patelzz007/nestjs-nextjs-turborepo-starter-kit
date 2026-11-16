import * as React from "react";
import { Filters } from "@workspace/ui/components/filters/filters";
import { createFilterQuery, createFilterRule } from "@workspace/ui/components/filters/filters-query";
import type { FilterField, FilterQuery } from "@workspace/ui/components/filters/filters-types";

const FIELDS: readonly FilterField[] = [
	{
		id: "status",
		label: "Status",
		type: "select",
		options: [
			{ value: "open", label: "Open" },
			{ value: "paid", label: "Paid" },
			{ value: "overdue", label: "Overdue" },
		],
	},
	{ id: "customer", label: "Customer", type: "text" },
];

function initialQuery(): FilterQuery {
	return createFilterQuery([createFilterRule({ id: "applied-1", path: ["status"], operator: "is", value: "overdue" })]);
}

export function FiltersDo2Example(): React.JSX.Element {
	const [query, setQuery] = React.useState<FilterQuery>(initialQuery);
	return <Filters fields={FIELDS} query={query} onQueryChange={setQuery} showClear />;
}
