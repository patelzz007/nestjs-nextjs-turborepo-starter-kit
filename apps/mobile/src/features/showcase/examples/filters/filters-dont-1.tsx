import type { FilterBarField } from "@workspace/ui-native/lib/filters";
import * as React from "react";

import { FilterBar } from "./filters-sample";

/** Storage names as labels, and free text where the values are a fixed list. */
const FIELDS: readonly FilterBarField[] = [
	{ id: "status", label: "status_cd", type: "text" },
	{ id: "priority", label: "prio_lvl", type: "text" },
];

export function FiltersDont1Example(): React.JSX.Element {
	return <FilterBar fields={FIELDS} />;
}
