// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { useAbility } from "@workspace/client/lib/contexts/authorization";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MerchantAuthorizationProvider, useMerchantAuthorizationStatus } from "@/contexts/tenancy/components/access/merchant-authorization-provider";
import { resolveMerchantCapabilities } from "@/lib/session/server-capabilities";
import { membershipFixture } from "@/testing/authorization";

const { merchantCapabilities } = vi.hoisted(() => ({
	merchantCapabilities: vi.fn(),
}));

vi.mock("@/contexts/tenancy/lib/tenant/capabilities", () => ({
	useMerchantCapabilities: merchantCapabilities,
}));

function Probe(): React.JSX.Element {
	const ability = useAbility();
	const { isLoading, capabilities } = useMerchantAuthorizationStatus();
	return (
		<ul>
			<li>{`loading:${String(isLoading)}`}</li>
			<li>{`capabilities:${String(capabilities.length)}`}</li>
			<li>{`manageRewards:${String(ability.can("UPDATE", "REWARD"))}`}</li>
			<li>{`manageTeam:${String(ability.can("UPDATE", "MEMBER"))}`}</li>
			<li>{`manageVerification:${String(ability.can("UPDATE", "KYB"))}`}</li>
		</ul>
	);
}

afterEach((): void => {
	cleanup();
	merchantCapabilities.mockReset();
});

describe("MerchantAuthorizationProvider", () => {
	it("feeds the session's CASL ability from the active membership", () => {
		const membership = membershipFixture("OWNER");
		merchantCapabilities.mockReturnValue({ membership, capabilities: resolveMerchantCapabilities(membership), isLoading: false, isPolicyReady: true });

		render(
			<MerchantAuthorizationProvider>
				<Probe />
			</MerchantAuthorizationProvider>,
		);

		expect(screen.getByText(`capabilities:${String(resolveMerchantCapabilities(membership).length)}`)).toBeTruthy();
		expect(screen.getByText("manageRewards:true")).toBeTruthy();
		expect(screen.getByText("manageTeam:true")).toBeTruthy();
		expect(screen.getByText("manageVerification:true")).toBeTruthy();
	});

	it("exposes tenant management as capabilities, not roles (admins cannot manage verification)", () => {
		const membership = membershipFixture("MANAGER");
		merchantCapabilities.mockReturnValue({ membership, capabilities: resolveMerchantCapabilities(membership), isLoading: false, isPolicyReady: true });

		render(
			<MerchantAuthorizationProvider>
				<Probe />
			</MerchantAuthorizationProvider>,
		);

		expect(screen.getByText("manageTeam:true")).toBeTruthy();
		expect(screen.getByText("manageVerification:false")).toBeTruthy();
	});

	it("reports loading and denies while the memberships query is pending", () => {
		merchantCapabilities.mockReturnValue({ membership: undefined, capabilities: [], isLoading: true, isPolicyReady: false });

		render(
			<MerchantAuthorizationProvider>
				<Probe />
			</MerchantAuthorizationProvider>,
		);

		expect(screen.getByText("loading:true")).toBeTruthy();
		expect(screen.getByText("capabilities:0")).toBeTruthy();
		expect(screen.getByText("manageRewards:false")).toBeTruthy();
		expect(screen.getByText("manageTeam:false")).toBeTruthy();
	});
});
