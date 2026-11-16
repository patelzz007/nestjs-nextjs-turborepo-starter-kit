import { render, screen } from "@testing-library/react-native";
import ShoppingBagIcon from "lucide-react-native/icons/shopping-bag";
import * as React from "react";
import type { ViewInstance } from "react-native";

import { DEFAULT_KPI_DIRECTION_LABELS, describeKpi, KpiStatCard, type KpiChange } from "../kpi-stat-card";

const UP: KpiChange = { status: "change", direction: "up", sentiment: "positive", label: "+12.4%" };
const DOWN_BAD: KpiChange = { status: "change", direction: "down", sentiment: "negative", label: "-3.1%" };

describe("describeKpi", () => {
	it("says the direction in words, then the comparison", () => {
		expect(describeKpi("Revenue", "RM 48,210", UP, "vs the previous 30 days", DEFAULT_KPI_DIRECTION_LABELS)).toBe("Revenue: RM 48,210, up +12.4% vs the previous 30 days");
		expect(describeKpi("Refunds", "12", DOWN_BAD, undefined, DEFAULT_KPI_DIRECTION_LABELS)).toBe("Refunds: 12, down -3.1%");
	});

	it("reads no previous data as its own state, and nothing when there is no change", () => {
		expect(describeKpi("Referrals", "214", { status: "noPrevious", label: "New this period" }, undefined, DEFAULT_KPI_DIRECTION_LABELS)).toBe(
			"Referrals: 214, New this period",
		);
		expect(describeKpi("Users", "9,312", undefined, undefined, DEFAULT_KPI_DIRECTION_LABELS)).toBe("Users: 9,312");
	});
});

describe("KpiStatCard", () => {
	it("shows the value and its change, tinted by sentiment, as one spoken element", async () => {
		await render(<KpiStatCard label="Revenue" value="RM 48,210" change={UP} comparisonLabel="vs the previous 30 days" icon={ShoppingBagIcon} iconTone="green" />);
		expect(screen.getByLabelText("Revenue: RM 48,210, up +12.4% vs the previous 30 days")).toBeOnTheScreen();
		expect(screen.getByText("+12.4%")).toHaveProp("className", expect.stringContaining("text-tone-green"));
	});

	it("tints bad news red, whichever way it moved", async () => {
		await render(<KpiStatCard label="Refunds" value="12" change={DOWN_BAD} />);
		expect(screen.getByText("-3.1%")).toHaveProp("className", expect.stringContaining("text-tone-red"));
	});

	it("holds bones and is announced busy while loading, or while it has no value", async () => {
		const view = await render(<KpiStatCard label="Revenue" value="RM 48,210" change={UP} loading testID="kpi" />);
		expect(screen.queryByText("RM 48,210")).toBeNull();
		expect(screen.getByTestId("kpi")).toHaveProp("accessibilityState", { busy: true });
		await view.rerender(<KpiStatCard label="Revenue" value={undefined} testID="kpi" />);
		expect(screen.getByTestId("kpi")).toHaveProp("accessibilityLabel", "Revenue");
	});

	it("takes the directions' words of another language", async () => {
		await render(<KpiStatCard label="Umsatz" value="48.210 €" change={UP} directionLabels={{ up: "gestiegen", down: "gesunken", flat: "unverändert" }} />);
		expect(screen.getByLabelText("Umsatz: 48.210 €, gestiegen +12.4%")).toBeOnTheScreen();
	});

	it("forwards its ref and merges className last", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<KpiStatCard ref={ref} label="Users" value="9" className="flex-1" testID="kpi" />);
		expect(ref.current).not.toBeNull();
		expect(String(screen.getByTestId("kpi").props.className).split(" ").at(-1)).toBe("flex-1");
	});
});
