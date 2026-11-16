import type { FilterBarField } from "@workspace/ui-native/lib/filters";
import * as React from "react";

import { FilterBar, PRIORITIES, STATUSES } from "./filters-sample";

/** Fields people know by name, each with the choices it can hold. */
const FIELDS: readonly FilterBarField[] = [
	{ id: "status", label: "Status", type: "multiselect", options: STATUSES },
	{ id: "priority", label: "Priority", type: "select", options: PRIORITIES },
];

export function FiltersDo1Example(): React.JSX.Element {
	return <FilterBar fields={FIELDS} />;
}
