import { cleanup, render, screen } from "@testing-library/react";
import { Wallet } from "lucide-react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { KpiStatCard, type KpiChange } from "./kpi-stat-card";

afterEach((): void => {
	cleanup();
});

const UP_GOOD: KpiChange = { status: "change", direction: "up", sentiment: "positive", label: "+12.5%" };

describe("KpiStatCard", () => {
	it("shows the label, the value and the change with words for its direction", (): void => {
		render(<KpiStatCard label="Sales" value="RM 1,234.50" change={UP_GOOD} comparisonLabel="vs previous 30 days" icon={Wallet} />);

		expect(screen.getByText("Sales")).toBeTruthy();
		expect(screen.getByText("RM 1,234.50")).toBeTruthy();
		// The direction is spoken, not only drawn: icon + "Up" + the signed change.
		expect(screen.getByText("+12.5%").textContent).toBe("Up +12.5%");
		expect(screen.getByText("vs previous 30 days")).toBeTruthy();
	});

	it("colours by sentiment, not by direction", (): void => {
		render(<KpiStatCard label="Refunds" value="4" change={{ status: "change", direction: "up", sentiment: "negative", label: "+2" }} />);

		expect(screen.getByText("+2").className).toContain("text-destructive");
	});

	it("says so when there was nothing to compare with", (): void => {
		render(<KpiStatCard label="Sales" value="RM 10.00" change={{ status: "noPrevious", label: "No data in the previous period" }} />);

		expect(screen.getByText("No data in the previous period")).toBeTruthy();
		expect(screen.queryByText("Up")).toBeNull();
	});

	it("uses the caller's direction words", (): void => {
		render(
			<KpiStatCard
				label="Bills"
				value="0"
				change={{ status: "change", direction: "flat", sentiment: "neutral", label: "0%" }}
				directionLabels={{ up: "Naik", down: "Turun", flat: "Tiada perubahan" }}
			/>,
		);

		expect(screen.getByText("0%").textContent).toBe("Tiada perubahan 0%");
	});

	it("renders a busy skeleton while loading", (): void => {
		const { container } = render(<KpiStatCard label="Sales" value={undefined} change={UP_GOOD} />);

		expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
		expect(screen.queryByText("+12.5%")).toBeNull();
	});

	it("forwards its ref to the card", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		render(<KpiStatCard ref={ref} label="Sales" value="1" data-testid="kpi" />);

		expect(ref.current).toBe(screen.getByTestId("kpi"));
	});
});
