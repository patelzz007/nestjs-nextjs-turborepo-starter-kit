// @vitest-environment jsdom
import { cleanup, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MerchantApiKeysPageView } from "@/components/api-keys/merchant-api-keys-page-view";
import { renderWithAuthorization, TEST_ORG_SLUG } from "@/test/authorization";

const { apiKeysListQuery, apiKeysMutation } = vi.hoisted(() => ({
	apiKeysListQuery: vi.fn(),
	apiKeysMutation: vi.fn(),
}));

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): object => ({
		api: {
			organizations: {
				apiKeys: {
					list: { useQuery: apiKeysListQuery },
					create: { useMutation: apiKeysMutation },
					revoke: { useMutation: apiKeysMutation },
				},
			},
		},
	}),
}));

const ACTIVE_KEY = {
	id: "4d9a3f5e-2f6b-4c55-8f0c-9a4b1c2d3e4f",
	name: "Front counter",
	locationName: null,
	revokedAt: null,
};

beforeEach((): void => {
	apiKeysListQuery.mockReturnValue({ data: { data: [ACTIVE_KEY] }, refetch: vi.fn() });
	apiKeysMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
});

afterEach((): void => {
	cleanup();
	apiKeysListQuery.mockReset();
	apiKeysMutation.mockReset();
});

describe("MerchantApiKeysPageView authorization", () => {
	it("shows create and revoke actions with merchant:manage_api_keys", () => {
		renderWithAuthorization(<MerchantApiKeysPageView orgSlug={TEST_ORG_SLUG} />, { role: "ADMIN" });

		expect(screen.getByRole("button", { name: "Create API key" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Revoke" })).toBeTruthy();
	});

	it("renders the access-denied page and never lists keys without the capability", () => {
		renderWithAuthorization(<MerchantApiKeysPageView orgSlug={TEST_ORG_SLUG} />, { role: "CASHIER" });

		expect(screen.getByText("Owner or admin access required")).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Create API key" })).toBeNull();
		expect(apiKeysListQuery).not.toHaveBeenCalled();
	});

	it("renders the loading state while the membership resolves", () => {
		renderWithAuthorization(<MerchantApiKeysPageView orgSlug={TEST_ORG_SLUG} />, { isLoading: true });

		expect(screen.getByRole("status", { name: "Checking access" })).toBeTruthy();
		expect(screen.queryByText("Owner or admin access required")).toBeNull();
	});
});
