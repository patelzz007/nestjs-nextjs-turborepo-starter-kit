// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { Wallet } from "lucide-react";
import { afterEach, describe, expect, it } from "vitest";

import { AnalyticsKpiGrid } from "./analytics-kpi-grid";
import type { KpiView } from "./analytics-presentation";

afterEach((): void => {
	cleanup();
});

const KPIS: readonly KpiView<"sales" | "bills">[] = [
	{ key: "sales", label: "Sales", icon: Wallet, iconTone: "green", value: "RM 10.00", change: { status: "change", direction: "up", sentiment: "positive", label: "+5%" } },
	{ key: "bills", label: "Bills", icon: undefined, iconTone: undefined, value: undefined, change: undefined },
];

describe("AnalyticsKpiGrid", () => {
	it("renders one card per KPI inside a named group, with the comparison period", () => {
		render(<AnalyticsKpiGrid kpis={KPIS} comparisonLabel="vs 1 – 30 Sep 2026" label="Sales" />, { wrapper: UiKitTestProviders });

		const group = within(screen.getByRole("group", { name: "Sales" }));
		expect(group.getByText("RM 10.00")).toBeTruthy();
		expect(group.getByText("vs 1 – 30 Sep 2026")).toBeTruthy();
		// A KPI without data yet shows its skeleton, not a value.
		expect(group.getByText("Bills")).toBeTruthy();
	});

	it("draws each KPI's icon in a tile of the tone its definition chose", () => {
		const { container } = render(<AnalyticsKpiGrid kpis={KPIS} comparisonLabel="vs 1 – 30 Sep 2026" label="Sales" />, { wrapper: UiKitTestProviders });

		const tiles = container.querySelectorAll('[data-slot="icon-tile"]');
		expect(tiles).toHaveLength(1);
		expect(tiles[LIST_SLOT_INDEX.first]?.getAttribute("data-tone")).toBe("green");
	});
});
