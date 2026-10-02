// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CapabilitiesProvider } from "@workspace/client/lib/auth/can";
import { PERMISSION, type CapabilitySlug } from "@workspace/shared";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

const { FIRST_REQUEST_ID, SECOND_REQUEST_ID } = vi.hoisted(() => ({
	FIRST_REQUEST_ID: "3f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a01",
	SECOND_REQUEST_ID: "3f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a02",
}));

// The panel reads its selection from the address bar, as Next.js's
// `useSearchParams` does once the History API integration has synced it.
vi.mock("next/navigation", () => ({
	useSearchParams: (): URLSearchParams => new URLSearchParams(window.location.search),
}));

vi.mock("@workspace/client/lib/auth", () => {
	const request: LocationRequestStub = {
		id: FIRST_REQUEST_ID,
		organizationId: "org-1",
		organizationDisplayName: "Sunrise Café",
		name: "Bangsar outlet",
		code: "SUN-02",
		addressText: "1 Jalan Telawi",
		city: "KUALA_LUMPUR",
		contactPhone: null,
	};
	const second: LocationRequestStub = {
		id: SECOND_REQUEST_ID,
		organizationId: "org-2",
		organizationDisplayName: "Moonlight Bakery",
		name: "Gurney outlet",
		code: "MOON-02",
		addressText: "2 Gurney Drive",
		city: "PENANG",
		contactPhone: null,
	};
	const auth: AuthStub = {
		api: {
			rewardsAdmin: {
				listLocationRequests: { useQuery: () => ({ data: { data: [request, second] }, isLoading: false }) },
				reviewOrganizationLocation: { useMutation: () => ({ mutate: () => undefined, isPending: false }) },
			},
		},
	};
	return { useAuth: (): AuthStub => auth };
});

const PATH = "/merchants/store-requests";

function panel(capabilities: readonly CapabilitySlug[]): React.JSX.Element {
	return (
		<QueryClientProvider client={new QueryClient()}>
			<CapabilitiesProvider capabilities={capabilities}>
				<LocationRequestsPanel />
			</CapabilitiesProvider>
		</QueryClientProvider>
	);
}

function renderPanel(capabilities: readonly CapabilitySlug[]): ReturnType<typeof render> {
	return render(panel(capabilities));
}

beforeEach(() => {
	window.history.replaceState(null, "", PATH);
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
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

describe("LocationRequestsPanel selection (URL is the only source)", () => {
	it("reviews the first pending request when the URL selects none", () => {
		renderPanel([PERMISSION.MERCHANT_ORG.LIST]);
		expect(screen.getByText("1 Jalan Telawi")).toBeDefined();
		expect(screen.queryByText("2 Gurney Drive")).toBeNull();
	});

	it("reviews the request named by ?requestId=", () => {
		window.history.replaceState(null, "", `${PATH}?requestId=${SECOND_REQUEST_ID}`);
		renderPanel([PERMISSION.MERCHANT_ORG.LIST]);
		expect(screen.getByText("2 Gurney Drive")).toBeDefined();
		expect(screen.queryByText("1 Jalan Telawi")).toBeNull();
	});

	it("pushes a picked request to the URL and follows the URL back", () => {
		const pushState = vi.spyOn(window.history, "pushState");
		const view = renderPanel([PERMISSION.MERCHANT_ORG.LIST]);
		fireEvent.click(screen.getByRole("button", { name: /Gurney outlet/ }));
		expect(pushState).toHaveBeenCalledTimes(1);
		expect(window.location.search).toBe(`?requestId=${SECOND_REQUEST_ID}`);
		view.rerender(panel([PERMISSION.MERCHANT_ORG.LIST]));
		expect(screen.getByText("2 Gurney Drive")).toBeDefined();

		window.history.replaceState(null, "", PATH);
		view.rerender(panel([PERMISSION.MERCHANT_ORG.LIST]));
		expect(screen.getByText("1 Jalan Telawi")).toBeDefined();
	});
});
