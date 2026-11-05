// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { epochMs, PERMISSION, type FeatureFlag } from "@workspace/shared";
import { accessibilityViolations } from "@workspace/ui/testing/axe";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { describeSetting, FeatureFlagsView } from "@/contexts/feature-flags/components/feature-flags-view";

const { listQuery, updateMutate, permissions } = vi.hoisted(() => ({ listQuery: vi.fn(), updateMutate: vi.fn(), permissions: { granted: new Set<string>() } }));

vi.mock("@tanstack/react-query", async (importOriginal) => ({ ...(await importOriginal<object>()), useQueryClient: (): object => ({ invalidateQueries: vi.fn() }) }));
vi.mock("@workspace/client/lib/contexts/authorization", () => ({ useAuthorization: (): object => ({ can: (slug: string): boolean => permissions.granted.has(slug) }) }));
vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({ api: { featureFlags: { list: { useQuery: listQuery }, update: { useMutation: (): object => ({ mutate: updateMutate, isPending: false }) } } } }),
}));

const GALLERY: FeatureFlag = {
	key: "component-gallery",
	title: "Component gallery",
	description: "The developer gallery.",
	defaultFrom: "ADMIN_COMPONENT_GALLERY",
	scope: "platform",
	mode: "ON",
	percentage: null,
	reason: "Everyone uses it",
	updatedAt: epochMs(Date.UTC(2026, 10, 1, 9, 0)),
	updatedByName: "Sam Staff",
};
const INVITES: FeatureFlag = { ...GALLERY, key: "merchant-invites", title: "Merchant invites", mode: "DEFAULT", reason: null, updatedAt: null, updatedByName: null };

beforeEach((): void => {
	listQuery.mockReturnValue({ data: { data: { flags: [GALLERY, INVITES] } } });
	permissions.granted = new Set<string>([PERMISSION.FEATURE_FLAG.UPDATE]);
});

afterEach((): void => {
	cleanup();
	vi.clearAllMocks();
});

describe("describeSetting", () => {
	it("says what a setting means", () => {
		expect(describeSetting({ mode: "PERCENTAGE", percentage: 25 })).toBe("On for 25% of people");
		expect(describeSetting({ mode: "DEFAULT", percentage: null })).toBe("Default");
	});
});

describe("FeatureFlagsView", () => {
	it("shows each flag with its default's source, its setting and who last changed it", () => {
		// Read as a look-only staff member: no change form, so each setting's words appear once.
		permissions.granted = new Set();
		render(<FeatureFlagsView />, { wrapper: UiKitTestProviders });
		const gallery = within(screen.getByRole("region", { name: "Component gallery" }));
		expect(gallery.getByText("On")).toBeTruthy();
		expect(gallery.getByText("ADMIN_COMPONENT_GALLERY")).toBeTruthy();
		expect(gallery.getByText(/by Sam Staff: Everyone uses it/u)).toBeTruthy();
		expect(within(screen.getByRole("region", { name: "Merchant invites" })).getByText("Default")).toBeTruthy();
	});

	it("saves a change only with a reason", () => {
		render(<FeatureFlagsView />, { wrapper: UiKitTestProviders });
		const form = within(screen.getByRole("form", { name: "Change Component gallery" }));
		expect(form.getByRole("button", { name: "Save" })).toHaveProperty("disabled", true);
		act((): void => {
			fireEvent.change(form.getByLabelText("Why (kept in the audit log)"), { target: { value: "Back to the deployment default" } });
		});
		act((): void => {
			fireEvent.click(form.getByRole("button", { name: "Save" }));
		});
		expect(updateMutate).toHaveBeenCalledWith({ key: "component-gallery", mode: "ON", percentage: null, reason: "Back to the deployment default" });
	});

	it("offers no change to staff who may only look", () => {
		permissions.granted = new Set();
		render(<FeatureFlagsView />, { wrapper: UiKitTestProviders });
		expect(screen.queryByRole("form", { name: "Change Component gallery" })).toBeNull();
	});

	it("has no serious accessibility problems (enhancement 3.2)", async () => {
		render(<FeatureFlagsView />, { wrapper: UiKitTestProviders });
		await expect(accessibilityViolations(document.body)).resolves.toStrictEqual([]);
	});
});
