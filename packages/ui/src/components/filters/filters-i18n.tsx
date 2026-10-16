import { isStringPrimitive } from "@workspace/shared";

import type { FilterDraftStep, FilterIssue, FilterIssueReason, FilterLabels } from "./filters-types";

/**
 * The filters family reads its copy from the UI kit's label system (family
 * `filters`, plus `filterOperators` for operator wording) — there is no second
 * i18n mechanism here. These helpers only pick the right string.
 */

/**
 * The sentence for one issue. Takes the ISSUE, not just the reason: a field's
 * `validate` supplies its own words, so `custom` has nothing to look up.
 */
export function filterIssueLabel(issue: Pick<FilterIssue, "reason" | "message"> | FilterIssueReason, labels: FilterLabels): string {
	if (isStringPrimitive(issue)) {
		return reasonLabel(issue, labels);
	}
	if (issue.message !== undefined && issue.message !== "") {
		return issue.message;
	}
	return reasonLabel(issue.reason, labels);
}

function reasonLabel(reason: FilterIssueReason, labels: FilterLabels): string {
	switch (reason) {
		case "missing-operator":
			return labels.issueOperator;
		case "incomplete-range":
			return labels.issueRange;
		case "reversed-range":
			return labels.issueRangeOrder;
		case "empty-group":
			return labels.issueEmptyGroup;
		case "missing-value":
		case "custom":
			return labels.issueValue;
		default:
			return assertNeverFilterIssueReason(reason);
	}
}

function assertNeverFilterIssueReason(value: never): never {
	throw new Error(`Unhandled filter issue reason: ${JSON.stringify(value)}`);
}

/** The search placeholder for a step's panel. */
export function stepPlaceholder(step: FilterDraftStep, labels: FilterLabels): string {
	if (step === "field") {
		return labels.searchFields;
	}
	if (step === "operator") {
		return labels.searchOperators;
	}
	return labels.searchOptions;
}
