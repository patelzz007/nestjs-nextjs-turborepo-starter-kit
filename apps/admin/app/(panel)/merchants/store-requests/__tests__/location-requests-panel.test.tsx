// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { CapabilitiesProvider } from "@workspace/client/lib/auth/can";
import { PERMISSION, type CapabilitySlug } from "@workspace/shared";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import LocationRequestsPanel from "../location-requests-panel";

/** Only the request fields the panel renders. */
interface LocationRequestStub {
	readonly id: string;
	readonly organizationId: string;
	readonly organizationDisplayName: string;
	readonly name: string;
	readonly code: string;
	readonly addressText: string | null;
	readonly city: string | null;
	readonly contactPhone: string | null;
}

interface AuthStub {
	readonly api: {
		readonly rewardsAdmin: {
			readonly listLocationRequests: { readonly useQuery: () => { readonly data: { readonly data: readonly LocationRequestStub[] }; readonly isLoading: boolean } };
			readonly reviewOrganizationLocation: { readonly useMutation: () => { readonly mutate: () => void; readonly isPending: boolean } };
		};
	};
}

vi.mock("@workspace/client/lib/auth", () => {
	const request: LocationRequestStub = {
		id: "location-1",
		organizationId: "org-1",
		organizationDisplayName: "Sunrise Café",
		name: "Bangsar outlet",
		code: "SUN-02",
		addressText: "1 Jalan Telawi",
		city: "KUALA_LUMPUR",
		contactPhone: null,
	};
	const auth: AuthStub = {
		api: {
			rewardsAdmin: {
				listLocationRequests: { useQuery: () => ({ data: { data: [request] }, isLoading: false }) },
				reviewOrganizationLocation: { useMutation: () => ({ mutate: () => undefined, isPending: false }) },
			},
		},
	};
	return { useAuth: (): AuthStub => auth };
});

function renderPanel(capabilities: readonly CapabilitySlug[]): void {
	render(
		<QueryClientProvider client={new QueryClient()}>
			<CapabilitiesProvider capabilities={capabilities}>
				<LocationRequestsPanel />
			</CapabilitiesProvider>
		</QueryClientProvider>,
	);
}

afterEach(() => {
	cleanup();
});

describe("LocationRequestsPanel authorization", () => {
	it("shows the review form with MERCHANT_ORG manage", () => {
		renderPanel([PERMISSION.MERCHANT_ORG.MANAGE]);
		expect(screen.getByRole("button", { name: "Approve store" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Reject" })).toBeDefined();
		expect(screen.queryByRole("note")).toBeNull();
	});

	it("shows request details read-only with a notice for LIST-only sessions", () => {
		renderPanel([PERMISSION.MERCHANT_ORG.LIST]);
		expect(screen.getByText("1 Jalan Telawi")).toBeDefined();
		expect(screen.queryByRole("button", { name: "Approve store" })).toBeNull();
		expect(screen.queryByLabelText("Rejection reason")).toBeNull();
		expect(screen.getByText("Approving or rejecting store requests requires the merchant organization manage permission.")).toBeDefined();
	});
});
