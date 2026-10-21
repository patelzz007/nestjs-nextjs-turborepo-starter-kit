// @vitest-environment node
import * as React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AnalyticsRangePickerSkeleton } from "../analytics-range-picker-skeleton";

describe("AnalyticsRangePickerSkeleton", () => {
	it("server-renders the picker's resting row at its size, hidden from assistive technology", () => {
		const html = renderToString(<AnalyticsRangePickerSkeleton className="mt-2" />);

		expect(html).toContain('data-slot="analytics-range-picker-skeleton"');
		expect(html).toContain('aria-hidden="true"');
		expect(html).toContain("min-w-44");
		expect(html).toContain("min-w-28");
		expect(html.match(/h-10/gu)).toHaveLength(2);
		expect(html).toContain("mt-2");
	});
});
