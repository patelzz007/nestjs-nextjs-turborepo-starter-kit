import { createFilterQuery, createFilterRule, type FilterQuery } from "@workspace/ui-kit-logic";
import type { FilterBarField } from "@workspace/ui-native/lib/filters";
import * as React from "react";

import { FilterBar, STATUSES } from "./filters-sample";

const FIELDS: readonly FilterBarField[] = [{ id: "status", label: "Status", type: "multiselect", options: STATUSES }];

const SEED: FilterQuery = createFilterQuery([createFilterRule({ id: "open", path: ["status"], operator: "has_any_of", value: ["todo", "in-progress"] })]);

/** What is applied stays on screen as chips, with Clear all. */
export function FiltersDo2Example(): React.JSX.Element {
	return <FilterBar fields={FIELDS} initial={SEED} />;
}
