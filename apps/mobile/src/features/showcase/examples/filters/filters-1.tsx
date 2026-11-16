import { createFilterQuery, createFilterRule, type FilterQuery } from "@workspace/ui-kit-logic";
import type { FilterBarField } from "@workspace/ui-native/lib/filters";
import ArchiveIcon from "lucide-react-native/icons/archive";
import BuildingIcon from "lucide-react-native/icons/building-2";
import CircleDotIcon from "lucide-react-native/icons/circle-dot";
import FlagIcon from "lucide-react-native/icons/flag";
import GaugeIcon from "lucide-react-native/icons/gauge";
import GlobeIcon from "lucide-react-native/icons/globe";
import TextIcon from "lucide-react-native/icons/text";
import UserIcon from "lucide-react-native/icons/user";
import UsersIcon from "lucide-react-native/icons/users";
import * as React from "react";

import { FilterBar, PEOPLE, PRIORITIES, STATUSES } from "./filters-sample";

/** Nine fields on one bar: text, choices, people with an exclusive Unassigned, a nested company, a number and a flag. */
const FIELDS: readonly FilterBarField[] = [
	{ id: "description", label: "Description", type: "text", icon: TextIcon },
	{ id: "status", label: "Status", type: "multiselect", icon: CircleDotIcon, options: STATUSES },
	{ id: "priority", label: "Priority", type: "select", icon: FlagIcon, options: PRIORITIES },
	{ id: "assignee", label: "Assignee", type: "multiselect", icon: UsersIcon, options: [...PEOPLE, { value: "unassigned", label: "Unassigned", exclusive: true }] },
	{
		id: "country",
		label: "Country",
		type: "select",
		icon: GlobeIcon,
		options: ["Malaysia", "Singapore", "Japan", "Germany"].map((name: string) => ({ value: name.toLowerCase(), label: name })),
	},
	{ id: "contact", label: "Contact", type: "select", icon: UserIcon, options: PEOPLE },
	{
		id: "company",
		label: "Company",
		icon: BuildingIcon,
		fields: [
			{ id: "team", label: "Team", type: "select", options: ["Platform", "Growth", "Design"].map((name: string) => ({ value: name.toLowerCase(), label: name })) },
			{ id: "location", label: "Primary location", type: "text" },
		],
	},
	{ id: "score", label: "Score", type: "number", icon: GaugeIcon },
	{ id: "archived", label: "Archived", type: "boolean", icon: ArchiveIcon },
];

const SEED: FilterQuery = createFilterQuery([
	createFilterRule({ id: "seed-1", path: ["status"], operator: "has_any_of", value: ["in-progress", "review"] }),
	createFilterRule({ id: "seed-2", path: ["priority"], operator: "is", value: "urgent" }),
]);

// Everything in one bar, with the query it builds printed underneath.
export function Filters1Example(): React.JSX.Element {
	return <FilterBar fields={FIELDS} initial={SEED} showQuery />;
}
