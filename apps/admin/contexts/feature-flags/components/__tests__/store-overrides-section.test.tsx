// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { epochMs, type FeatureFlagStoreOption, type FeatureFlagStoreOverride } from "@workspace/shared";
import { accessibilityViolations } from "@workspace/ui/testing/axe";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { describeStore, StoreOverridesSection } from "@/contexts/feature-flags/components/store-overrides-section";

const { overridesQuery, storesQuery, setMutate, removeMutate } = vi.hoisted(() => ({
	overridesQuery: vi.fn(),
	storesQuery: vi.fn(),
	setMutate: vi.fn(),
	removeMutate: vi.fn(),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => ({ ...(await importOriginal<object>()), useQueryClient: (): object => ({ invalidateQueries: vi.fn() }) }));
vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({
		api: {
			featureFlags: {
				overrides: { useQuery: overridesQuery },
				stores: { useQuery: storesQuery },
				setOverride: { useMutation: (): object => ({ mutate: setMutate, isPending: false }) },
				removeOverride: { useMutation: (): object => ({ mutate: removeMutate, isPending: false }) },
			},
		},
	}),
}));

const MERCHANT = "0190f0e0-0000-7000-8000-000000000001";
const KATIL = "0190f0e0-0000-7000-8000-000000000002";
const MERCHANT_WIDE: FeatureFlagStoreOverride = {
	id: "0190f0e0-0000-7000-8000-000000000003",
	key: "till-redemption",
	tenantId: MERCHANT,
	tenantName: "Jonker Street Kitchen",
	locationId: null,
	locationName: null,
	enabled: true,
	reason: "Every branch redeems",
	updatedAt: epochMs(Date.UTC(2026, 10, 1, 9, 0)),
	updatedByName: "Sam Staff",
};
const KATIL_OFF: FeatureFlagStoreOverride = {
	...MERCHANT_WIDE,
	id: "0190f0e0-0000-7000-8000-000000000004",
	locationId: KATIL,
	locationName: "Bukit Katil",
	enabled: false,
	reason: "Tills being replaced",
};
const STORES: readonly FeatureFlagStoreOption[] = [{ tenantId: MERCHANT, tenantName: "Jonker Street Kitchen", branches: [{ locationId: KATIL, name: "Bukit Katil" }] }];

function renderSection(canChange = true): void {
	render(<StoreOverridesSection flagKey="till-redemption" title="Till redemption" canChange={canChange} />, { wrapper: UiKitTestProviders });
}

beforeEach((): void => {
	overridesQuery.mockReturnValue({ data: { data: { overrides: [MERCHANT_WIDE, KATIL_OFF] } } });
	storesQuery.mockReturnValue({ data: { data: { stores: STORES } } });
});

afterEach((): void => {
	cleanup();
	vi.clearAllMocks();
});

describe("describeStore", () => {
	it("names a branch, or the whole merchant", () => {
		expect(describeStore(KATIL_OFF)).toBe("Bukit Katil");
		expect(describeStore(MERCHANT_WIDE)).toBe("Jonker Street Kitchen, every branch");
	});
});

describe("StoreOverridesSection", () => {
	it("lists each store's own setting with who set it and why", () => {
		renderSection(false);
		const katil = within(screen.getByText("Bukit Katil").closest("li") ?? document.body);
		expect(katil.getByText("Off")).toBeTruthy();
		expect(katil.getByText(/by Sam Staff: Tills being replaced/u)).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
		expect(screen.queryByRole("form", { name: "Set Till redemption for a store" })).toBeNull();
	});

	it("says when no store has its own setting", () => {
		overridesQuery.mockReturnValue({ data: { data: { overrides: [] } } });
		renderSection();
		expect(screen.getByText(/every store follows the one above/u)).toBeTruthy();
	});

	it("removes a setting only with a reason", () => {
		renderSection();
		const katil = within(screen.getByText("Bukit Katil").closest("li") ?? document.body);
		act((): void => {
			fireEvent.click(katil.getByRole("button", { name: "Remove" }));
		});
		const form = within(screen.getByRole("form", { name: "Remove Bukit Katil's setting" }));
		expect(form.getByRole("button", { name: "Remove setting" })).toHaveProperty("disabled", true);
		act((): void => {
			fireEvent.change(form.getByLabelText("Why remove it (kept in the audit log)"), { target: { value: "The new tills are in" } });
		});
		act((): void => {
			fireEvent.click(form.getByRole("button", { name: "Remove setting" }));
		});
		expect(removeMutate).toHaveBeenCalledWith({ key: "till-redemption", overrideId: KATIL_OFF.id, reason: "The new tills are in" });
	});

	it("searches merchants by what is typed, and saves nothing until a merchant and a reason are given", () => {
		renderSection();
		act((): void => {
			fireEvent.change(screen.getByLabelText("Find a merchant"), { target: { value: " Jonker " } });
		});
		expect(storesQuery).toHaveBeenLastCalledWith({ search: "Jonker" });
		const form = within(screen.getByRole("form", { name: "Set Till redemption for a store" }));
		act((): void => {
			fireEvent.change(form.getByLabelText("Why (kept in the audit log)"), { target: { value: "Trying it at one branch" } });
		});
		expect(form.getByRole("button", { name: "Save store setting" })).toHaveProperty("disabled", true);
	});

	it("has no serious accessibility problems (enhancement 3.2)", async () => {
		renderSection();
		await expect(accessibilityViolations(document.body)).resolves.toStrictEqual([]);
	});
});
