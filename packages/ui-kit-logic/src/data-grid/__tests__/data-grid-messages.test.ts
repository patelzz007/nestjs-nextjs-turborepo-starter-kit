import { describe, expect, it } from "vitest";

import { formatMessage } from "@workspace/shared";
import { buildDataGridLabels, DATA_GRID_MESSAGES_EN } from "../data-grid-messages";

const LABELS = buildDataGridLabels(DATA_GRID_MESSAGES_EN, (message, values): string => formatMessage("en", message, values));

describe("buildDataGridLabels", () => {
	it("keeps plain strings and fills in every placeholder", () => {
		expect(LABELS.sortAscending).toBe("Asc");
		expect(LABELS.unpinColumn("Email")).toBe("Unpin Email column");
		expect(LABELS.paginationInfo({ from: 1, to: 5, count: 20 })).toBe("1 - 5 of 20");
		expect(LABELS.goToPage(3)).toBe("Go to page 3");
		expect(LABELS.filterSelectedCount(2)).toBe("2 selected");
		expect(LABELS.resizeColumn("Name")).toBe("Resize Name column");
		expect(LABELS.selectionBarCount(4)).toBe("4 selected");
	});
});
