import { describe, expect, it } from "vitest";

import { formatMessage } from "@workspace/shared";
import { buildFilterLabels, FILTER_MESSAGES_EN, FILTER_OPERATOR_LABELS_EN } from "../filters-messages";

const LABELS = buildFilterLabels(FILTER_MESSAGES_EN, (message, values): string => formatMessage("en", message, values));

describe("buildFilterLabels", () => {
	it("keeps plain strings and fills in placeholders and plurals", () => {
		expect(LABELS.addFilter).toBe(FILTER_MESSAGES_EN.addFilter);
		expect(LABELS.chipMenu("Status")).toContain("Status");
		expect(LABELS.valueCount(1)).not.toBe(LABELS.valueCount(2));
		expect(LABELS.valueDetail("2 values", ["Open", "Closed"])).toContain(`Open${FILTER_MESSAGES_EN.valueDetail.separator}Closed`);
		expect(LABELS.valueRange("1", "5")).toContain("5");
		expect(LABELS.rowLabel("Status is Open", 2)).toContain("Status is Open");
		expect(LABELS.groupAnnouncement(true)).not.toBe(LABELS.groupAnnouncement(false));
		expect(LABELS.moveAnnouncement("Status", "group 1", 2, 3)).toContain("Status");
	});

	it("names relative dates: today, tomorrow and yesterday, and counted days, weeks and more either way", () => {
		expect(LABELS.relativeDate({ unit: "day", offset: 1 })).toBe(FILTER_MESSAGES_EN.relativeDate.tomorrow);
		expect(LABELS.relativeDate({ unit: "day", offset: -1 })).toBe(FILTER_MESSAGES_EN.relativeDate.yesterday);
		expect(LABELS.relativeDate({ unit: "week", offset: 0 })).toContain("week");
		expect(LABELS.relativeDate({ unit: "day", offset: 3 })).toContain("3");
		expect(LABELS.relativeDate({ unit: "month", offset: -2 })).toContain("2");
	});

	it("ships an English name for every built-in operator", () => {
		expect(FILTER_OPERATOR_LABELS_EN.contains).toBe("contains");
		expect(FILTER_OPERATOR_LABELS_EN.not_between).toBe("is not between");
	});
});
