// @vitest-environment jsdom
import { cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import type { CustomerTier, TierAvailability } from "@workspace/shared";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MinimumTierSelect, minimumTierOptionLabel } from "../minimum-tier-select";
import { CUSTOMER_TIER_TONES, TierBadge } from "../tier-badge";
import { TIERS_AVAILABILITY_STALE_TIME_MS, useTiersEnabled } from "../use-tiers-enabled";

const mocks = vi.hoisted(() => ({
	availability: vi.fn<(input: undefined, options: { readonly staleTime: number }) => { readonly data: { readonly data: TierAvailability } | undefined }>(),
}));

vi.mock("../../identity", () => ({
	useAuth: (): object => ({ api: { tiers: { availability: { useQuery: mocks.availability } } } }),
}));

afterEach(() => {
	cleanup();
	mocks.availability.mockReset();
});

describe("TierBadge", () => {
	it("names the tier, and says a locked reward's tier is the only one that claims it", () => {
		render(<TierBadge tier="GOLD" />);
		expect(screen.getByText("Gold")).toBeTruthy();
		cleanup();
		render(<TierBadge tier="DIAMOND" locked />);
		expect(screen.getByText("Diamond only")).toBeTruthy();
	});

	it("gives every tier a tone", () => {
		expect(Object.keys(CUSTOMER_TIER_TONES)).toEqual(["BRONZE", "SILVER", "GOLD", "DIAMOND"]);
	});
});

describe("minimumTierOptionLabel", () => {
	it("says Bronze is every customer, and any other tier that tier and above", () => {
		expect(minimumTierOptionLabel("BRONZE")).toBe("Every customer");
		expect(minimumTierOptionLabel("SILVER")).toBe("Silver and above");
	});
});

describe("MinimumTierSelect", () => {
	it("shows the chosen tier and reports another tier when picked", async () => {
		const onValueChange = vi.fn<(tier: CustomerTier) => void>();
		render(<MinimumTierSelect id="minimumTier" value="BRONZE" onValueChange={onValueChange} />, { wrapper: UiKitTestProviders });

		const trigger = screen.getByRole("combobox");
		expect(trigger.textContent).toContain("Every customer");
		fireEvent.click(trigger);
		const gold = await screen.findByRole("option", { name: "Gold and above" });
		fireEvent.pointerDown(gold, { pointerType: "mouse" });
		fireEvent.click(gold);
		expect(onValueChange).toHaveBeenCalledWith("GOLD");
	});
});

describe("useTiersEnabled", () => {
	it("is true only once the API says tiers are on", () => {
		mocks.availability.mockReturnValue({ data: { data: { enabled: true, viewerTier: "BRONZE" } } });
		expect(renderHook(() => useTiersEnabled()).result.current).toBe(true);
		expect(mocks.availability).toHaveBeenCalledWith(undefined, { staleTime: TIERS_AVAILABILITY_STALE_TIME_MS });

		mocks.availability.mockReturnValue({ data: { data: { enabled: false } } });
		expect(renderHook(() => useTiersEnabled()).result.current).toBe(false);

		mocks.availability.mockReturnValue({ data: undefined });
		expect(renderHook(() => useTiersEnabled()).result.current).toBe(false);
	});
});
