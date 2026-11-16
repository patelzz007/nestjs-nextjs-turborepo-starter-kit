import * as React from "react";
import { Filters } from "@workspace/ui/components/filters/filters";
import { createFilterQuery } from "@workspace/ui/components/filters/filters-query";
import type { FilterField, FilterQuery } from "@workspace/ui/components/filters/filters-types";

const FIELDS: readonly FilterField[] = [
	{ id: "inv_status_cd", label: "inv_status_cd", type: "text" },
	{ id: "cust_nm", label: "cust_nm", type: "text" },
];

export function FiltersDont1Example(): React.JSX.Element {
	const [query, setQuery] = React.useState<FilterQuery>(() => createFilterQuery([]));
	return <Filters fields={FIELDS} query={query} onQueryChange={setQuery} />;
}
