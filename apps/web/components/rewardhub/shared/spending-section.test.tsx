// @vitest-environment jsdom
import { cleanup, getDefaultNormalizer, render, screen, within } from "@testing-library/react";
import type { UserSpendingSummary } from "@workspace/shared";
import { formatMinorUnits } from "@workspace/ui/lib/format/money";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SpendingSection } from "@/components/rewardhub/shared/spending-section";
import { toSpendingSectionState } from "@/lib/rewards/spending-insights";
import { ROUTES } from "@/lib/routes";

/** Keep Intl's no-break space after "RM" intact when matching formatted amounts. */
const KEEP_SPACES = { normalizer: getDefaultNormalizer({ collapseWhitespace: false }) };

/** Recharts' ResponsiveContainer observes its size; jsdom has no ResizeObserver. */
class ResizeObserverStub {
	public observe(): void {
		return;
	}
	public unobserve(): void {
		return;
	}
	public disconnect(): void {
		return;
	}
}

function buildSpending(overrides: Partial<UserSpendingSummary> = {}): UserSpendingSummary {
	return {
		currency: "MYR",
		totalSpentMinor: { value: 10_000, changePercent: 12.5 },
		visits: { value: 4, changePercent: -20 },
		byMerchant: [
			{ organizationId: "0b8f2a4e-6c1d-4e3f-8a9b-1c2d3e4f5a60", merchantName: "Kopi Corner", category: "cafe", totalMinor: 7_500, visits: 3 },
			{ organizationId: "1c9a3b5f-7d2e-4f40-9b0c-2d3e4f5a6b71", merchantName: "Nasi Lemak Hub", category: null, totalMinor: 2_500, visits: 1 },
		],
		byCategory: [
			{ category: "cafe", totalMinor: 7_500, visits: 3 },
			{ category: null, totalMinor: 2_500, visits: 1 },
		],
		...overrides,
	};
}

beforeEach((): void => {
	vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("SpendingSection", () => {
	it("is labelled by its heading and busy while loading, without breakdown lists", () => {
		render(<SpendingSection state={toSpendingSectionState(undefined)} />);

		const section = screen.getByRole("region", { name: "Your spending" });
		expect(section.getAttribute("aria-busy")).toBe("true");
		expect(screen.queryByRole("list", { name: "Shops ranked by your spending" })).toBeNull();
		expect(screen.queryByRole("list", { name: "Spending by category" })).toBeNull();
	});

	it("shows the totals and guidance instead of breakdowns when there were no paid bills", () => {
		render(
			<SpendingSection
				state={toSpendingSectionState(
					buildSpending({ totalSpentMinor: { value: 0, changePercent: null }, visits: { value: 0, changePercent: null }, byMerchant: [], byCategory: [] }),
				)}
			/>,
		);

		expect(screen.getByText(formatMinorUnits(0, "MYR"), KEEP_SPACES)).toBeDefined();
		expect(screen.getByText("Spending shows up after you redeem a reward at a participating shop.")).toBeDefined();
		expect(screen.getByRole("link", { name: "Browse rewards" }).getAttribute("href")).toBe(ROUTES.rewardHub.browse);
		expect(screen.queryByRole("list", { name: "Shops ranked by your spending" })).toBeNull();
	});

	it("shows total spent and visits with their change vs the previous period", () => {
		render(<SpendingSection state={toSpendingSectionState(buildSpending())} />);

		expect(screen.getByText("Total spent")).toBeDefined();
		expect(screen.getByText("Shop visits")).toBeDefined();
		expect(screen.getByText("+12.5%")).toBeDefined();
		expect(screen.getByText("-20%")).toBeDefined();
	});

	it("ranks the shops with amount, visits and share of spend stated as text", () => {
		render(<SpendingSection state={toSpendingSectionState(buildSpending())} />);

		const items = within(screen.getByRole("list", { name: "Shops ranked by your spending" })).getAllByRole("listitem");
		expect(items).toHaveLength(2);

		const [top, second] = items;
		expect(top?.textContent).toContain("Kopi Corner");
		expect(top?.textContent).toContain(formatMinorUnits(7_500, "MYR"));
		expect(top?.textContent).toContain("Café · 3 visits");
		expect(top?.textContent).toContain("75% of spend");
		expect(second?.textContent).toContain("Nasi Lemak Hub");
		expect(second?.textContent).toContain("Other · 1 visit");
	});

	it("does not announce the shop monogram on top of the shop name", () => {
		render(<SpendingSection state={toSpendingSectionState(buildSpending())} />);

		const list = screen.getByRole("list", { name: "Shops ranked by your spending" });
		expect(list.querySelector('[data-slot="entity-avatar"]')?.getAttribute("aria-hidden")).toBe("true");
	});

	it("lists every category with its amount and share, so colour is never the only cue", () => {
		render(<SpendingSection state={toSpendingSectionState(buildSpending())} />);

		const items = within(screen.getByRole("list", { name: "Spending by category" })).getAllByRole("listitem");
		expect(items.map((item) => item.textContent)).toEqual([`Café${formatMinorUnits(7_500, "MYR")}3 visits75%`, `Other${formatMinorUnits(2_500, "MYR")}1 visit25%`]);
	});
});
