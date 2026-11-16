import { createFilterQuery, flattenFilterConditions, type FilterCondition, type FilterQuery } from "@workspace/ui-kit-logic";
import { DataTable, type DataTableColumn } from "@workspace/ui-native/components/data-table";
import { Filters } from "@workspace/ui-native/components/filters";
import type { FilterBarField } from "@workspace/ui-native/lib/filters";
import * as React from "react";
import { View } from "react-native";

import { scalarText } from "./filters-sample";

interface Staff {
	readonly id: string;
	readonly name: string;
	readonly team: string;
	readonly role: string;
	readonly years: number;
}

const STAFF: readonly Staff[] = [
	{ id: "s1", name: "Ada Lovelace", team: "platform", role: "Engineer", years: 6 },
	{ id: "s2", name: "Grace Hopper", team: "platform", role: "Lead", years: 11 },
	{ id: "s3", name: "Alan Turing", team: "growth", role: "Analyst", years: 3 },
	{ id: "s4", name: "Katherine Johnson", team: "growth", role: "Engineer", years: 8 },
	{ id: "s5", name: "Edsger Dijkstra", team: "design", role: "Designer", years: 2 },
	{ id: "s6", name: "Barbara Liskov", team: "design", role: "Lead", years: 14 },
];

const TEAMS: readonly { readonly value: string; readonly label: string }[] = [
	{ value: "platform", label: "Platform" },
	{ value: "growth", label: "Growth" },
	{ value: "design", label: "Design" },
];

const FIELDS: readonly FilterBarField[] = [
	{ id: "name", label: "Name", type: "text" },
	{ id: "team", label: "Team", type: "multiselect", options: TEAMS },
	{ id: "years", label: "Years", type: "number" },
];

const COLUMNS: readonly DataTableColumn<Staff>[] = [
	{ id: "name", header: "Name", value: (row: Staff): string => row.name },
	{ id: "team", header: "Team", width: "sm", value: (row: Staff): string => TEAMS.find((team) => team.value === row.team)?.label ?? row.team },
	{ id: "role", header: "Role", width: "sm", value: (row: Staff): string => row.role },
	{ id: "years", header: "Years", width: "sm", align: "end", value: (row: Staff): string => String(row.years) },
];

/** One condition against one row: the operators these three fields offer. A server would run the same query as SQL. */
export function staffMatches(row: Staff, condition: FilterCondition): boolean {
	const [first = null, second = null] = condition.values;
	const text = condition.field === "name" ? row.name.toLowerCase() : "";
	const picks = condition.values.map(scalarText);
	const outcome = ((): boolean => {
		switch (condition.operator) {
			case "contains":
				return text.includes(scalarText(first).toLowerCase());
			case "not_contains":
				return !text.includes(scalarText(first).toLowerCase());
			case "is_any_of":
			case "has_any_of":
				return picks.includes(row.team);
			case "is_none_of":
			case "has_none_of":
				return !picks.includes(row.team);
			case "gt":
				return row.years > Number(first);
			case "gte":
				return row.years >= Number(first);
			case "lt":
				return row.years < Number(first);
			case "lte":
				return row.years <= Number(first);
			case "eq":
				return row.years === Number(first);
			case "between":
				return row.years >= Number(first) && row.years <= Number(second);
			default:
				return true;
		}
	})();
	return condition.negated ? !outcome : outcome;
}

/** The rows every condition keeps (the bar joins its chips with "and"). */
export function filterStaff(rows: readonly Staff[], query: FilterQuery): readonly Staff[] {
	const conditions = flattenFilterConditions(query);
	return rows.filter((row: Staff): boolean => conditions.every((condition: FilterCondition): boolean => staffMatches(row, condition)));
}

// The bar drives a table: each chip narrows the rows as soon as it has a value.
export function Filters7Example(): React.JSX.Element {
	const [query, setQuery] = React.useState<FilterQuery>(createFilterQuery());
	const rows = React.useMemo((): readonly Staff[] => filterStaff(STAFF, query), [query]);
	return (
		<View className="w-full gap-3">
			<Filters fields={FIELDS} query={query} onQueryChange={setQuery} />
			<DataTable data={rows} columns={COLUMNS} title="Staff" description={`${String(rows.length)} of ${String(STAFF.length)} people`} />
		</View>
	);
}
