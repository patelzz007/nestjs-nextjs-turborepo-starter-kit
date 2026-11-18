// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { SessionAbilityProvider } from "@workspace/client/lib/contexts/authorization";
import {
	DEFAULT_TIER_RULES,
	epochMs,
	PERMISSION,
	type AdminUserTier,
	type CapabilitySlug,
	type TierAvailability,
	type TierDistribution,
	type TierSettingsResponse,
} from "@workspace/shared";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TierDistributionPanel, toTierCounts } from "@/contexts/tiers/components/tier-distribution-panel";
import { TierSettingsView } from "@/contexts/tiers/components/tier-settings-view";
import { tierChangeLine, UserTierCard } from "@/contexts/tiers/components/user-tier-card";

const { mocks } = vi.hoisted(() => ({
	mocks: {
		availability: vi.fn<() => { readonly data: { readonly data: TierAvailability } | undefined }>(),
		settings: vi.fn<() => { readonly data: { readonly data: TierSettingsResponse } | undefined }>(),
		updateSettings: vi.fn(),
		userTier: vi.fn<(input: { readonly userId: string }, options: { readonly enabled: boolean }) => { readonly data: { readonly data: AdminUserTier } | undefined }>(),
		distribution: vi.fn<(input: undefined, options: { readonly enabled: boolean }) => object>(),
	},
}));

/** The signed-in staff member's capabilities, fed to the real session ability. */
const permissions: { granted: readonly CapabilitySlug[] } = { granted: [] };

/** The UI kit plus the session ability built from `permissions.granted`. */
function SettingsProviders({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
	return (
		<UiKitTestProviders>
			<SessionAbilityProvider capabilities={permissions.granted} namespace="platform">
				{children}
			</SessionAbilityProvider>
		</UiKitTestProviders>
	);
}

vi.mock("@tanstack/react-query", async (importOriginal) => ({ ...(await importOriginal<object>()), useQueryClient: (): object => ({ invalidateQueries: vi.fn() }) }));
vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({
		api: {
			tiers: {
				availability: { useQuery: mocks.availability },
				settings: { useQuery: mocks.settings },
				updateSettings: { useMutation: (): object => ({ mutate: mocks.updateSettings, isPending: false }) },
				userTier: { useQuery: mocks.userTier },
				distribution: { useQuery: mocks.distribution },
			},
		},
	}),
}));

const SETTINGS: TierSettingsResponse = {
	...DEFAULT_TIER_RULES,
	reason: "Launch rules",
	updatedAt: epochMs(Date.UTC(2026, 10, 1, 9, 0)),
	updatedByName: "Sam Staff",
};
const ON: TierAvailability = { enabled: true, viewerTier: "BRONZE" };
const NOW = Date.UTC(2026, 10, 17);

beforeEach((): void => {
	mocks.availability.mockReturnValue({ data: { data: ON } });
	mocks.settings.mockReturnValue({ data: { data: SETTINGS } });
	permissions.granted = [PERMISSION.SYSTEM_SETTINGS.UPDATE];
});

afterEach((): void => {
	cleanup();
	vi.clearAllMocks();
});

describe("TierSettingsView", () => {
	it("shows the rules read-only, with who last changed them, to staff who may only read them", () => {
		permissions.granted = [];
		render(<TierSettingsView />, { wrapper: SettingsProviders });

		expect(screen.getByText(/by Sam Staff: Launch rules/u)).toBeTruthy();
		expect(screen.getByText("Gold at").nextElementSibling?.textContent).toBe("25");
		expect(screen.queryByRole("form", { name: "Change the tier rules" })).toBeNull();
	});

	it("saves changed rules with a reason, and refuses to save without one", () => {
		render(<TierSettingsView />, { wrapper: SettingsProviders });
		const form = within(screen.getByRole("form", { name: "Change the tier rules" }));

		fireEvent.change(form.getByLabelText("Gold at"), { target: { value: "30" } });
		fireEvent.click(form.getByRole("button", { name: "Save rules" }));
		expect(mocks.updateSettings).not.toHaveBeenCalled();
		expect(form.getByLabelText("Why (kept in the audit log)").getAttribute("aria-invalid")).toBe("true");

		fireEvent.change(form.getByLabelText("Why (kept in the audit log)"), { target: { value: "Gold was too easy in the pilot" } });
		fireEvent.click(form.getByRole("button", { name: "Save rules" }));
		expect(mocks.updateSettings).toHaveBeenCalledWith({ ...DEFAULT_TIER_RULES, goldThreshold: 30, reason: "Gold was too easy in the pilot" });
	});

	it("says the rules are untouched before anyone changed them", () => {
		mocks.settings.mockReturnValue({ data: { data: { ...DEFAULT_TIER_RULES, reason: null, updatedAt: null, updatedByName: null } } });
		render(<TierSettingsView />, { wrapper: SettingsProviders });
		expect(screen.getByText("The launch rules: nobody has changed them yet.")).toBeTruthy();
	});
});

describe("UserTierCard", () => {
	const TIER: AdminUserTier = {
		tier: "GOLD",
		countedRedemptions: 27,
		holdUntil: epochMs(NOW + 86_400_000),
		demotionWarning: null,
		evaluatedAt: epochMs(NOW),
		history: [{ id: "0193f2c4-0000-7000-8000-0000000000d1", fromTier: "SILVER", toTier: "GOLD", reason: "PROMOTION", countedRedemptions: 25, occurredAt: epochMs(NOW) }],
	};

	it("shows the customer's tier, counts and history, read-only", () => {
		mocks.userTier.mockReturnValue({ data: { data: TIER } });
		render(<UserTierCard userId="u-1" />, { wrapper: UiKitTestProviders });

		expect(mocks.userTier).toHaveBeenCalledWith({ userId: "u-1" }, { enabled: true });
		expect(screen.getByText("Gold")).toBeTruthy();
		expect(screen.getByText("Counted redemptions").nextElementSibling?.textContent).toBe("27");
		expect(screen.getByText("Pending demotion").nextElementSibling?.textContent).toBe("None");
		expect(within(screen.getByRole("region", { name: "Tier history" })).getByText(/Moved up to Gold/u)).toBeTruthy();
		expect(screen.queryByRole("button")).toBeNull();
	});

	it("renders nothing while tiers are off, and never asks for the tier", () => {
		mocks.availability.mockReturnValue({ data: { data: { enabled: false } } });
		mocks.userTier.mockReturnValue({ data: undefined });
		const { container } = render(<UserTierCard userId="u-1" />, { wrapper: UiKitTestProviders });

		expect(container.textContent).toBe("");
		expect(mocks.userTier).toHaveBeenCalledWith({ userId: "u-1" }, { enabled: false });
	});

	it("words a change up or down", () => {
		expect(tierChangeLine({ reason: "PROMOTION", toTier: "GOLD" })).toBe("Moved up to Gold");
		expect(tierChangeLine({ reason: "DEMOTION", toTier: "SILVER" })).toBe("Moved down to Silver");
	});
});

describe("TierDistributionPanel", () => {
	const DISTRIBUTION: TierDistribution = { counts: { BRONZE: 6, SILVER: 4, GOLD: 24, DIAMOND: 0 }, total: 34 };

	it("lists every tier in tier order", () => {
		expect(toTierCounts({ counts: { DIAMOND: 1, GOLD: 2, SILVER: 0, BRONZE: 5 }, total: 8 })).toEqual([
			{ tier: "BRONZE", count: 5 },
			{ tier: "SILVER", count: 0 },
			{ tier: "GOLD", count: 2 },
			{ tier: "DIAMOND", count: 1 },
		]);
	});

	it("shows how many customers stand at each tier", () => {
		mocks.distribution.mockReturnValue({ data: { data: DISTRIBUTION }, isError: false, refetch: vi.fn() });
		render(<TierDistributionPanel />, { wrapper: UiKitTestProviders });

		expect(
			within(screen.getByRole("list", { name: "Customers by tier" }))
				.getAllByRole("listitem")
				.map((item) => item.textContent),
		).toEqual(["Bronze617.6%", "Silver411.8%", "Gold2470.6%", "Diamond00%"]);
	});

	it("renders nothing while tiers are off", () => {
		mocks.availability.mockReturnValue({ data: { data: { enabled: false } } });
		mocks.distribution.mockReturnValue({ data: undefined, isError: false, refetch: vi.fn() });
		const { container } = render(<TierDistributionPanel />, { wrapper: UiKitTestProviders });
		expect(container.textContent).toBe("");
	});
});
