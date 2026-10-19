// ============================================
// contexts/reporting — the context's public surface
// ============================================
// Reporting — the activity dashboard and its insights.
// Code outside this folder (routes in src/app, runtime features, screen tests)
// imports from here, never from a file inside it
// (docs/architecture/ddd-cqrs-migration-plan.md §14.5).

export { ActivityDashboard } from "./activity-dashboard";
export {
	ACTIVITY_RANGE_OPTIONS,
	type ActivityRangeChoice,
	activityRangeOfDays,
	type ActivitySelection,
	activityToday,
	choiceOf,
	CUSTOM_RANGE_ISSUE_MESSAGES,
	customRangeIssueOf,
	DEFAULT_ACTIVITY_SELECTION,
	earliestActivityDate,
	selectedActivityDays,
	selectedActivityRange,
} from "./activity-range";
export { rangeLabelOf } from "./presentation";
export { useActivityDashboard, useActivityInsights, useActivityToday } from "./use-activity-dashboard";
