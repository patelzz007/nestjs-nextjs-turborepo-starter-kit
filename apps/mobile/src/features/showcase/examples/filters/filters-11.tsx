import { countFilterRules, createFilterGroup, createFilterQuery, createFilterRule, insertFilterNode, FILTER_ROOT_ID, type FilterQuery } from "@workspace/ui-kit-logic";
import { Badge } from "@workspace/ui-native/components/badge";
import { Button } from "@workspace/ui-native/components/button";
import { Filters } from "@workspace/ui-native/components/filters";
import type { FilterBarField } from "@workspace/ui-native/lib/filters";
import * as React from "react";
import { View } from "react-native";

import { PEOPLE, PRIORITIES, STATUSES } from "./filters-sample";

const FIELDS: readonly FilterBarField[] = [
	{ id: "status", label: "Status", type: "multiselect", options: STATUSES },
	{ id: "priority", label: "Priority", type: "select", options: PRIORITIES },
	{ id: "assignee", label: "Assignee", type: "select", options: PEOPLE },
	{ id: "title", label: "Title", type: "text" },
];

/** A saved group: "high or urgent, and not done". */
function savedGroup(id: string): ReturnType<typeof createFilterGroup> {
	return createFilterGroup({
		id,
		rules: [
			createFilterRule({ id: `${id}-priority`, path: ["priority"], operator: "is_any_of", value: ["high", "urgent"] }),
			createFilterRule({ id: `${id}-status`, path: ["status"], operator: "has_none_of", value: ["done"] }),
		],
	});
}

// The builder inline, a button that drops in a saved group, and a live count of rules.
export function Filters11Example(): React.JSX.Element {
	const [query, setQuery] = React.useState<FilterQuery>(createFilterQuery());
	const loads = React.useRef(0);
	const load = React.useCallback((): void => {
		loads.current += 1;
		setQuery((current: FilterQuery): FilterQuery => insertFilterNode(current, savedGroup(`saved-${String(loads.current)}`), FILTER_ROOT_ID));
	}, []);
	const count = countFilterRules(query);
	return (
		<View className="w-full gap-3">
			<View className="flex-row items-center gap-2">
				<Button label="Add saved group" variant="outline" size="sm" onPress={load} />
				<Badge label={count === 1 ? "1 rule" : `${String(count)} rules`} variant="light" tone="primary" />
			</View>
			<Filters fields={FIELDS} query={query} onQueryChange={setQuery} mode="builder" idSeed="inline" />
		</View>
	);
}
