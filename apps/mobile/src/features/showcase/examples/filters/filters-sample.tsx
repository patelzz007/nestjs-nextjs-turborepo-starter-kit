// What the Filters examples share: statuses with their colour dots, priorities, people, the query printed as JSON
// under a bar, and a filter bar that keeps its own query (most examples only show the bar).

import { createFilterQuery, isFilterDateValue, serializeFilterQuery, type FilterQuery, type FilterValueItem } from "@workspace/ui-kit-logic";
import { CodeBlock } from "@workspace/ui-native/components/code-block";
import { Filters, type FiltersProps } from "@workspace/ui-native/components/filters";
import type { FilterBarOption } from "@workspace/ui-native/lib/filters";
import * as React from "react";
import { View } from "react-native";

/** A status's dot, in its tone. */
function Dot({ className }: { readonly className: string }): React.JSX.Element {
	return <View className={`size-2.5 rounded-full ${className}`} />;
}

export const STATUSES: readonly FilterBarOption[] = [
	{ value: "todo", label: "To Do", leading: <Dot className="bg-muted-foreground" /> },
	{ value: "in-progress", label: "In Progress", leading: <Dot className="bg-tone-yellow" /> },
	{ value: "review", label: "In Review", leading: <Dot className="bg-tone-blue" /> },
	{ value: "done", label: "Done", leading: <Dot className="bg-tone-green" /> },
	{ value: "cancelled", label: "Cancelled", leading: <Dot className="bg-destructive" /> },
];

export const PRIORITIES: readonly FilterBarOption[] = [
	{ value: "low", label: "Low", leading: <Dot className="bg-tone-teal" /> },
	{ value: "medium", label: "Medium", leading: <Dot className="bg-tone-yellow" /> },
	{ value: "high", label: "High", leading: <Dot className="bg-tone-orange" /> },
	{ value: "urgent", label: "Urgent", leading: <Dot className="bg-tone-red" /> },
];

export const PEOPLE: readonly FilterBarOption[] = [
	{ value: "ada", label: "Ada Lovelace" },
	{ value: "grace", label: "Grace Hopper" },
	{ value: "alan", label: "Alan Turing" },
	{ value: "katherine", label: "Katherine Johnson" },
	{ value: "edsger", label: "Edsger Dijkstra" },
	{ value: "barbara", label: "Barbara Liskov" },
	{ value: "margaret", label: "Margaret Hamilton" },
	{ value: "linus", label: "Linus Torvalds" },
];

/** A value item as text: a scalar as it reads, nothing for no value or a date (dates have their own editors). */
export function scalarText(item: FilterValueItem | undefined): string {
	return item === null || item === undefined || isFilterDateValue(item) ? "" : String(item);
}

/** The query as JSON, as a server would receive it. */
export function QueryPreview({ query }: { readonly query: FilterQuery }): React.JSX.Element {
	return <CodeBlock code={JSON.stringify(JSON.parse(serializeFilterQuery(query)), null, 2)} language="json" caption="Query" />;
}

/** A filter bar over its own query: the examples that only show the bar. */
export function FilterBar(
	props: Omit<FiltersProps, "query" | "onQueryChange"> & { readonly initial?: FilterQuery | undefined; readonly showQuery?: boolean | undefined },
): React.JSX.Element {
	const { initial, showQuery = false, ...rest } = props;
	const [query, setQuery] = React.useState<FilterQuery>(initial ?? createFilterQuery());
	return (
		<View className="w-full gap-3">
			<Filters {...rest} query={query} onQueryChange={setQuery} />
			{showQuery ? <QueryPreview query={query} /> : null}
		</View>
	);
}
