// The event calendar's recurrence rules: shared with the native kit (@workspace/ui-kit-logic `event-calendar`), re-exported
// under the web kit's own names.

export {
	EventCalendarRecurrenceError,
	eventCalendarExpandRecurrence as expandRecurrence,
	eventCalendarFormatRRuleString as formatRRuleString,
	EVENT_CALENDAR_MAX_OCCURRENCES as MAX_OCCURRENCES,
	eventCalendarParseRRuleString as parseRRuleString,
	eventCalendarResolveRecurrenceRule as resolveRecurrenceRule,
} from "@workspace/ui-kit-logic";
