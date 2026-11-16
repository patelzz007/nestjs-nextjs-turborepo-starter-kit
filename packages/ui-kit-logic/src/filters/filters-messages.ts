// The filter bar's copy, shared by the web and native kits: the shape of one language's filter messages, the English
// messages and operator names, and the builder that turns messages into the bar's labels (functions where a
// message has placeholders). The web builds every language's pack from its catalogues; the native kit builds English.

import type { FilterLabels, FilterRelativeDate } from "./filters-model";
import type { FilterOperatorLabels } from "./filters-operators";

export interface FilterMessages {
	readonly addFilter: string;
	readonly advancedFilter: string;
	readonly showRecords: string;
	readonly builderEmpty: string;
	readonly builderEmptyHint: string;
	readonly addCondition: string;
	readonly addConditionGroup: string;
	readonly addToGroup: string;
	readonly removeGroup: string;
	readonly wrapInGroup: string;
	readonly ungroup: string;
	readonly moveToTopLevel: string;
	readonly moveToGroup: string;
	readonly reorder: string;
	readonly reorderHint: string;
	readonly groupAll: string;
	readonly groupAny: string;
	readonly groupPlaceholder: string;
	readonly rowLabel: string;
	readonly groupLabel: string;
	readonly groupAnnouncement: string;
	readonly reorderAnnouncement: string;
	readonly moveAnnouncement: string;
	readonly clearAll: string;
	readonly groupMenu: string;
	readonly searchFields: string;
	readonly searchOperators: string;
	readonly searchOptions: string;
	readonly back: string;
	readonly clear: string;
	readonly apply: string;
	readonly discard: string;
	readonly empty: string;
	readonly loading: string;
	readonly loadingMore: string;
	readonly loadMore: string;
	readonly error: string;
	readonly retry: string;
	readonly where: string;
	readonly and: string;
	readonly or: string;
	readonly combinator: string;
	readonly combinatorLabel: string;
	readonly duplicate: string;
	readonly negate: string;
	readonly convertToAdvanced: string;
	readonly remove: string;
	readonly chipMenu: string;
	readonly filtersLabel: string;
	readonly filterLabel: string;
	readonly readOnly: string;
	readonly pathSeparator: string;
	readonly valuePlaceholder: string;
	readonly selectPlaceholder: string;
	readonly noValue: string;
	readonly selectCondition: string;
	readonly incomplete: string;
	readonly branchAffordance: string;
	readonly exclusiveHint: string;
	readonly exclusiveAnnouncement: string;
	readonly itemCount: string;
	readonly fieldsLabel: string;
	readonly resultsAnnouncement: string;
	readonly actionsLabel: string;
	readonly stepAnnouncement: string;
	readonly countAnnouncement: string;
	readonly valueCount: string;
	readonly valueDetail: {
		readonly message: string;
		readonly separator: string;
	};
	readonly valueRange: string;
	readonly rangeFrom: string;
	readonly rangeTo: string;
	readonly rangeSeparator: string;
	readonly negated: string;
	readonly booleanTrue: string;
	readonly booleanFalse: string;
	readonly relativeDate: {
		readonly tomorrow: string;
		readonly yesterday: string;
		readonly current: string;
		readonly future: string;
		readonly past: string;
	};
	readonly issueOperator: string;
	readonly issueValue: string;
	readonly issueRange: string;
	readonly issueRangeOrder: string;
	readonly issueEmptyGroup: string;
	readonly issueSummary: string;
}

export const FILTER_MESSAGES_EN: FilterMessages = {
	addFilter: "Add filter",
	advancedFilter: "Advanced filter",
	showRecords: "In this view, show records",
	builderEmpty: "No filters yet",
	builderEmptyHint: "Add a filter to narrow down what you see.",
	addCondition: "Add filter",
	addConditionGroup: "Add group",
	addToGroup: "Add filter to this group",
	removeGroup: "Remove group",
	wrapInGroup: "Wrap in group",
	ungroup: "Ungroup",
	moveToTopLevel: "Move to top",
	moveToGroup: "Move to group {position}",
	reorder: "Reorder",
	reorderHint: "Press Alt with Arrow Up or Arrow Down to reorder",
	groupAll: "All of the following are true…",
	groupAny: "Any of the following are true…",
	groupPlaceholder: "Drag filters here",
	rowLabel: "{condition}, level {depth}",
	groupLabel: "{description} level {depth}",
	groupAnnouncement: "{added, select, true {Group added} other {Group removed}}",
	reorderAnnouncement: "{label} moved to position {position} of {total}",
	moveAnnouncement: "{label} moved into {destination}, position {position} of {total}",
	clearAll: "Clear all",
	groupMenu: "Group options",
	searchFields: "Search attributes…",
	searchOperators: "Search operators…",
	searchOptions: "Search…",
	back: "Back",
	clear: "Clear",
	apply: "Apply",
	discard: "Discard changes",
	empty: "No results",
	loading: "Loading…",
	loadingMore: "Loading more…",
	loadMore: "Load more",
	error: "Could not load",
	retry: "Retry",
	where: "Where",
	and: "And",
	or: "Or",
	combinator: "Change combinator",
	combinatorLabel: "{word}, change combinator",
	duplicate: "Duplicate",
	negate: "Negate",
	convertToAdvanced: "Advanced editor",
	remove: "Remove",
	chipMenu: "{fieldLabel} filter options",
	filtersLabel: "Filters",
	filterLabel: "{condition}",
	readOnly: "Read only. These filters cannot be changed.",
	pathSeparator: " > ",
	valuePlaceholder: "enter text…",
	selectPlaceholder: "Select…",
	noValue: "no value",
	selectCondition: "Select condition",
	incomplete: "incomplete filter",
	branchAffordance: "opens a list",
	exclusiveHint: "cannot be combined with the other options",
	exclusiveAnnouncement: "{cleared, plural, one {{label} selected. 1 other selection cleared.} other {{label} selected. # other selections cleared.}}",
	itemCount: "{count, plural, one {# items} other {# items}}",
	fieldsLabel: "Attributes",
	resultsAnnouncement: "{count, plural, one {# result} other {# results}}",
	actionsLabel: "Actions",
	stepAnnouncement: "{step, select, field {Choose an attribute. {label}} operator {Choose a condition for {label}} other {Enter a value for {label}}}",
	countAnnouncement: "{count, plural, one {# filter applied} other {# filters applied}}",
	valueCount: "{count} selected",
	valueDetail: {
		message: "{summary}: {values}",
		separator: ", ",
	},
	valueRange: "{from} to {to}",
	rangeFrom: "{fieldLabel} from",
	rangeTo: "{fieldLabel} to",
	rangeSeparator: "to",
	negated: "not {operatorLabel}",
	booleanTrue: "True",
	booleanFalse: "False",
	relativeDate: {
		tomorrow: "tomorrow",
		yesterday: "yesterday",
		current: "{unit, select, day {today} week {this week} month {this month} other {this year}}",
		future:
			"in {count, plural, one {# {unit, select, day {day} week {week} month {month} other {year}}} other {# {unit, select, day {days} week {weeks} month {months} other {years}}}}",
		past: "{count, plural, one {# {unit, select, day {day} week {week} month {month} other {year}}} other {# {unit, select, day {days} week {weeks} month {months} other {years}}}} ago",
	},
	issueOperator: "Choose a condition",
	issueValue: "Enter a value",
	issueRange: "Enter both ends of the range",
	issueRangeOrder: "The end of the range comes before its start",
	issueEmptyGroup: "This group has no conditions yet",
	issueSummary: "{count, plural, one {# row needs attention} other {# rows need attention}}",
};

export const FILTER_OPERATOR_LABELS_EN: FilterOperatorLabels = {
	contains: "contains",
	not_contains: "does not contain",
	starts_with: "starts with",
	ends_with: "ends with",
	is: "is",
	is_not: "is not",
	is_any_of: "is any of",
	is_none_of: "is none of",
	has_any_of: "has any of",
	has_all_of: "has all of",
	has_none_of: "has none of",
	eq: "equals",
	neq: "does not equal",
	gt: "is greater than",
	gte: "is greater than or equal to",
	lt: "is less than",
	lte: "is less than or equal to",
	between: "is between",
	not_between: "is not between",
	is_before: "is before",
	is_after: "is after",
	is_on_or_before: "is on or before",
	is_on_or_after: "is on or after",
	empty: "is empty",
	not_empty: "is not empty",
};

/** Fills one message's `{placeholders}` (ICU syntax, plurals included) for the language at hand. */
export type FilterMessageFormatter = (message: string, values: Readonly<Record<string, string | number>>) => string;

/** The filter bar's copy from one language's messages: plain strings as they are, the rest as functions of their values. */
export function buildFilterLabels(m: FilterMessages, t: FilterMessageFormatter): FilterLabels {
	const relativeDateOf = ({ unit, offset }: FilterRelativeDate): string => {
		const words = m.relativeDate;
		if (offset === 0) {
			return t(words.current, { unit });
		}
		if (unit === "day" && Math.abs(offset) === 1) {
			return offset > 0 ? words.tomorrow : words.yesterday;
		}
		return t(offset > 0 ? words.future : words.past, { unit, count: Math.abs(offset) });
	};
	return {
		...m,
		moveToGroup: (position) => t(m.moveToGroup, { position }),
		rowLabel: (condition, depth) => t(m.rowLabel, { condition, depth }),
		groupLabel: (description, depth) => t(m.groupLabel, { description, depth }),
		groupAnnouncement: (added) => t(m.groupAnnouncement, { added: String(added) }),
		reorderAnnouncement: (label, position, total) => t(m.reorderAnnouncement, { label, position, total }),
		moveAnnouncement: (label, destination, position, total) => t(m.moveAnnouncement, { label, destination, position, total }),
		combinatorLabel: (word) => t(m.combinatorLabel, { word }),
		chipMenu: (fieldLabel) => t(m.chipMenu, { fieldLabel }),
		filterLabel: (condition) => t(m.filterLabel, { condition }),
		exclusiveAnnouncement: (label, cleared) => t(m.exclusiveAnnouncement, { label, cleared }),
		itemCount: (count) => t(m.itemCount, { count }),
		resultsAnnouncement: (count) => t(m.resultsAnnouncement, { count }),
		stepAnnouncement: (step, label) => t(m.stepAnnouncement, { step, label }),
		countAnnouncement: (count) => t(m.countAnnouncement, { count }),
		valueCount: (count) => t(m.valueCount, { count }),
		valueDetail: (summary, values) => t(m.valueDetail.message, { summary, values: values.join(m.valueDetail.separator) }),
		valueRange: (from, to) => t(m.valueRange, { from, to }),
		rangeFrom: (fieldLabel) => t(m.rangeFrom, { fieldLabel }),
		rangeTo: (fieldLabel) => t(m.rangeTo, { fieldLabel }),
		negated: (operatorLabel) => t(m.negated, { operatorLabel }),
		relativeDate: (date) => relativeDateOf(date),
		issueSummary: (count) => t(m.issueSummary, { count }),
	};
}
