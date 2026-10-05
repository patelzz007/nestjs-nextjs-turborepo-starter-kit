// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AnalyticsKpiGrid } from "./analytics-kpi-grid";
import type { KpiView } from "./analytics-presentation";

afterEach((): void => {
	cleanup();
});

const KPIS: readonly KpiView<"sales" | "bills">[] = [
	{ key: "sales", label: "Sales", icon: undefined, value: "RM 10.00", change: { status: "change", direction: "up", sentiment: "positive", label: "+5%" } },
	{ key: "bills", label: "Bills", icon: undefined, value: undefined, change: undefined },
];

describe("AnalyticsKpiGrid", () => {
	it("renders one card per KPI inside a named group, with the comparison period", () => {
		render(<AnalyticsKpiGrid kpis={KPIS} comparisonLabel="vs 1 – 30 Sep 2026" label="Sales" />);

		const group = within(screen.getByRole("group", { name: "Sales" }));
		expect(group.getByText("RM 10.00")).toBeTruthy();
		expect(group.getByText("vs 1 – 30 Sep 2026")).toBeTruthy();
		// A KPI without data yet shows its skeleton, not a value.
		expect(group.getByText("Bills")).toBeTruthy();
	});
});
