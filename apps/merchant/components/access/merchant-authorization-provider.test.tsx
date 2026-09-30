// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { useAuthorization } from "@workspace/client/lib/auth/can";
import { MERCHANT_CAPABILITY } from "@workspace/shared";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MerchantAuthorizationProvider, useMerchantAuthorizationStatus, useMerchantRoleAccess } from "@/components/access/merchant-authorization-provider";
import { resolveMerchantCapabilities } from "@/lib/session/server-capabilities";
import { membershipFixture } from "@/test/authorization";

const { merchantCapabilities } = vi.hoisted(() => ({
	merchantCapabilities: vi.fn(),
}));

vi.mock("@/lib/org/capabilities", () => ({
	useMerchantCapabilities: merchantCapabilities,
}));

function Probe(): React.JSX.Element {
	const { can } = useAuthorization();
	const { isLoading, membershipRole } = useMerchantAuthorizationStatus();
	const canManageTeam = useMerchantRoleAccess("manageTeam");
	return (
		<ul>
			<li>{`loading:${String(isLoading)}`}</li>
			<li>{`role:${membershipRole ?? "none"}`}</li>
			<li>{`manageRewards:${String(can(MERCHANT_CAPABILITY.manageRewards))}`}</li>
			<li>{`manageTeam:${String(canManageTeam)}`}</li>
		</ul>
	);
}

afterEach((): void => {
	cleanup();
	merchantCapabilities.mockReset();
});

describe("MerchantAuthorizationProvider", () => {
	it("feeds the shared can() API from the active membership", () => {
		const membership = membershipFixture("OWNER");
		merchantCapabilities.mockReturnValue({ membership, capabilities: resolveMerchantCapabilities(membership), isLoading: false, isPolicyReady: true });

		render(
			<MerchantAuthorizationProvider>
				<Probe />
			</MerchantAuthorizationProvider>,
		);

		expect(screen.getByText("role:OWNER")).toBeTruthy();
		expect(screen.getByText("manageRewards:true")).toBeTruthy();
		expect(screen.getByText("manageTeam:true")).toBeTruthy();
	});

	it("reports loading and denies while the memberships query is pending", () => {
		merchantCapabilities.mockReturnValue({ membership: undefined, capabilities: [], isLoading: true, isPolicyReady: false });

		render(
			<MerchantAuthorizationProvider>
				<Probe />
			</MerchantAuthorizationProvider>,
		);

		expect(screen.getByText("loading:true")).toBeTruthy();
		expect(screen.getByText("role:none")).toBeTruthy();
		expect(screen.getByText("manageRewards:false")).toBeTruthy();
		expect(screen.getByText("manageTeam:false")).toBeTruthy();
	});
});
