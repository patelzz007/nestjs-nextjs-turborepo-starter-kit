import {
	countFilterRules,
	createFilterGroup,
	createFilterQuery,
	createFilterRule,
	createFilterOperators,
	FILTER_OPERATOR_LABELS_EN,
	type FilterQuery,
} from "@workspace/ui-kit-logic";
import { BottomSheet } from "@workspace/ui-native/components/bottom-sheet";
import { Button } from "@workspace/ui-native/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui-native/components/card";
import { Filters } from "@workspace/ui-native/components/filters";
import type { FilterBarField } from "@workspace/ui-native/lib/filters";
import * as React from "react";
import { Text, View } from "react-native";

import { PEOPLE, PRIORITIES, STATUSES } from "./filters-sample";

const FIELDS: readonly FilterBarField[] = [
	{ id: "status", label: "Status", type: "multiselect", options: STATUSES },
	{ id: "priority", label: "Priority", type: "select", options: PRIORITIES },
	{ id: "assignee", label: "Assignee", type: "select", options: PEOPLE },
	{ id: "estimate", label: "Estimate", type: "number", unit: " h" },
];

const TITLE = "Tasks";

/** Short labels: a phone row has room for "≥", not "is greater than or equal to". */
const SHORT = createFilterOperators({ ...FILTER_OPERATOR_LABELS_EN, eq: "=", neq: "≠", gt: ">", gte: "≥", lt: "<", lte: "≤", has_any_of: "any of", has_none_of: "none of" });

/** "Urgent, or anything Ada has in review". */
const SEED: FilterQuery = createFilterQuery(
	[
		createFilterRule({ id: "urgent", path: ["priority"], operator: "is", value: "urgent" }),
		createFilterGroup({
			id: "ada",
			rules: [
				createFilterRule({ id: "ada-who", path: ["assignee"], operator: "is", value: "ada" }),
				createFilterRule({ id: "ada-status", path: ["status"], operator: "has_any_of", value: ["review"] }),
			],
		}),
	],
	"or",
);

// The builder in a sheet opened from a card's header: groups of rows, with short operator names.
export function Filters10Example(): React.JSX.Element {
	const [query, setQuery] = React.useState<FilterQuery>(SEED);
	const [open, setOpen] = React.useState(false);
	const show = React.useCallback((): void => {
		setOpen(true);
	}, []);
	const hide = React.useCallback((): void => {
		setOpen(false);
	}, []);
	return (
		<Card className="w-full">
			<CardHeader>
				<View className="flex-row items-center justify-between gap-3">
					<CardTitle>{TITLE}</CardTitle>
					<Button label={`Filters (${String(countFilterRules(query))})`} variant="outline" size="sm" onPress={show} />
				</View>
			</CardHeader>
			<CardContent>
				<Text className="text-body font-sans text-muted-foreground">The list would show the tasks the filters keep.</Text>
			</CardContent>
			<BottomSheet visible={open} title="Filters" onClose={hide}>
				<Filters fields={FIELDS} query={query} onQueryChange={setQuery} mode="builder" operators={SHORT} idSeed="sheet" />
			</BottomSheet>
		</Card>
	);
}
