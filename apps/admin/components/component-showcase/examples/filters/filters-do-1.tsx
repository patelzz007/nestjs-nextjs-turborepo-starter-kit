import * as React from "react";
import { Filters } from "@workspace/ui/components/filters/filters";
import { createFilterQuery } from "@workspace/ui/components/filters/filters-query";
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

export function FiltersDo1Example(): React.JSX.Element {
	const [query, setQuery] = React.useState<FilterQuery>(() => createFilterQuery([]));
	return <Filters fields={FIELDS} query={query} onQueryChange={setQuery} />;
}
