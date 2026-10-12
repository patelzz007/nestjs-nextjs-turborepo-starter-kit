// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { Wallet } from "lucide-react";
import { afterEach, describe, expect, it } from "vitest";

import { MerchantDashboardStatCard } from "@/components/dashboard/merchant-dashboard-stat-card";

afterEach((): void => {
	cleanup();
});

describe("MerchantDashboardStatCard", () => {
	it("keeps the label in place and marks the card busy while the value loads", () => {
		const { container } = render(<MerchantDashboardStatCard label="Redemptions" icon={Wallet} tone="success" isLoading />);

		expect(screen.getByText("Redemptions")).toBeTruthy();
		expect(container.querySelector('[data-slot="card"]')?.getAttribute("aria-busy")).toBe("true");
		expect(container.querySelector('[data-slot="skeleton"]')?.closest('[aria-hidden="true"]')).not.toBeNull();
	});

	it("treats a missing value as still loading", () => {
		const { container } = render(<MerchantDashboardStatCard label="Redemptions" icon={Wallet} tone="success" />);

		expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
	});

	it("shows the value under the same label once it arrives, with nothing busy", () => {
		const { container } = render(<MerchantDashboardStatCard label="Redemptions" value="1,204" icon={Wallet} tone="success" changePercent={12} />);

		expect(screen.getByText("1,204")).toBeTruthy();
		expect(screen.getByText("Redemptions")).toBeTruthy();
		expect(screen.getByText("+12%")).toBeTruthy();
		expect(container.querySelector('[data-slot="card"]')?.getAttribute("aria-busy")).toBe("false");
		expect(container.querySelector('[data-slot="skeleton"]')).toBeNull();
	});
});
