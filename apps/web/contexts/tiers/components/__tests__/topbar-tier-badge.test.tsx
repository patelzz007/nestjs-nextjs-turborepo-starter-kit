// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { TierAvailability } from "@workspace/shared";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TopbarTierBadge } from "@/contexts/tiers/components/topbar-tier-badge";

const { availabilityUseQuery } = vi.hoisted(() => ({
	availabilityUseQuery: vi.fn<() => { readonly data: { readonly data: TierAvailability } | undefined }>(),
}));

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({ api: { tiers: { availability: { useQuery: availabilityUseQuery } } } }),
}));

afterEach(() => {
	cleanup();
	availabilityUseQuery.mockReset();
});

describe("TopbarTierBadge", () => {
	it("shows the customer's tier, linking to their tier page", () => {
		availabilityUseQuery.mockReturnValue({ data: { data: { enabled: true, viewerTier: "GOLD" } } });
		render(<TopbarTierBadge />, { wrapper: UiKitTestProviders });

		const link = screen.getByRole("link", { name: "Your tier: Gold. See your tier" });
		expect(link.getAttribute("href")).toBe("/dashboard/tier");
		expect(link.textContent).toBe("Gold");
	});

	it("shows nothing while tiers are off or the tier is still being read", () => {
		availabilityUseQuery.mockReturnValue({ data: { data: { enabled: false } } });
		const { container, rerender } = render(<TopbarTierBadge />, { wrapper: UiKitTestProviders });
		expect(container.textContent).toBe("");

		availabilityUseQuery.mockReturnValue({ data: undefined });
		rerender(<TopbarTierBadge />);
		expect(container.textContent).toBe("");
	});
});
