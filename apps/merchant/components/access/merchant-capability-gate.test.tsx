// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { Can, useAuthorization } from "@workspace/client/lib/auth/can";
import { MERCHANT_CAPABILITY } from "@workspace/shared";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { MerchantCapabilityGate } from "@/components/access/merchant-capability-gate";
import { renderWithAuthorization } from "@/test/authorization";

function ManageRewardsProbe(): React.JSX.Element {
	const { can } = useAuthorization();
	return <p>{can(MERCHANT_CAPABILITY.manageRewards) ? "can-manage" : "read-only"}</p>;
}

afterEach((): void => {
	cleanup();
});

describe("MerchantCapabilityGate", () => {
	it("renders children when the active membership grants the capability", () => {
		renderWithAuthorization(
			<MerchantCapabilityGate capability={MERCHANT_CAPABILITY.manageApiKeys}>
				<p>secret keys</p>
			</MerchantCapabilityGate>,
			{ role: "OWNER" },
		);

		expect(screen.getByText("secret keys")).toBeTruthy();
	});

	it("renders the access-denied fallback when the capability is missing", () => {
		renderWithAuthorization(
			<MerchantCapabilityGate capability={MERCHANT_CAPABILITY.manageApiKeys}>
				<p>secret keys</p>
			</MerchantCapabilityGate>,
			{ role: "CASHIER" },
		);

		expect(screen.queryByText("secret keys")).toBeNull();
		expect(screen.getByText("You don't have access to this page")).toBeTruthy();
	});

	it("renders a custom fallback when provided", () => {
		renderWithAuthorization(
			<MerchantCapabilityGate capability={MERCHANT_CAPABILITY.manageRewards} fallback={<p>custom denied</p>}>
				<p>editor</p>
			</MerchantCapabilityGate>,
			{ role: "MEMBER" },
		);

		expect(screen.getByText("custom denied")).toBeTruthy();
	});

	it("shows a loading skeleton instead of the denied state while the membership resolves", () => {
		renderWithAuthorization(
			<MerchantCapabilityGate capability={MERCHANT_CAPABILITY.viewRewards}>
				<p>rewards</p>
			</MerchantCapabilityGate>,
			{ isLoading: true },
		);

		expect(screen.getByRole("status", { name: "Checking access" })).toBeTruthy();
		expect(screen.queryByText("You don't have access to this page")).toBeNull();
		expect(screen.queryByText("rewards")).toBeNull();
	});

	it("denies everything without a provider (fail closed)", () => {
		render(
			<MerchantCapabilityGate capability={MERCHANT_CAPABILITY.viewDashboard}>
				<p>dashboard</p>
			</MerchantCapabilityGate>,
		);

		expect(screen.queryByText("dashboard")).toBeNull();
	});
});

describe("shared authorization API", () => {
	it("exposes can() and <Can> backed by the membership capabilities", () => {
		renderWithAuthorization(
			<>
				<ManageRewardsProbe />
				<Can permission={MERCHANT_CAPABILITY.viewAnalytics} fallback={<p>no analytics</p>}>
					<p>analytics</p>
				</Can>
			</>,
			{ role: "CASHIER" },
		);

		expect(screen.getByText("read-only")).toBeTruthy();
		expect(screen.getByText("analytics")).toBeTruthy();
	});

	it("grants manage capabilities to owners", () => {
		renderWithAuthorization(<ManageRewardsProbe />, { role: "ADMIN" });

		expect(screen.getByText("can-manage")).toBeTruthy();
	});
});

describe("MerchantCapabilityGate for organization management", () => {
	it("renders the verification form only for owners (merchant:manage_verification)", () => {
		renderWithAuthorization(
			<MerchantCapabilityGate capability={MERCHANT_CAPABILITY.manageVerification}>
				<p>kyb form</p>
			</MerchantCapabilityGate>,
			{ role: "OWNER" },
		);

		expect(screen.getByText("kyb form")).toBeTruthy();
	});

	it("renders the fallback for admins, who cannot manage verification", () => {
		renderWithAuthorization(
			<MerchantCapabilityGate capability={MERCHANT_CAPABILITY.manageVerification} fallback={<p>owner only</p>}>
				<p>kyb form</p>
			</MerchantCapabilityGate>,
			{ role: "ADMIN" },
		);

		expect(screen.queryByText("kyb form")).toBeNull();
		expect(screen.getByText("owner only")).toBeTruthy();
	});

	it("shows the loading skeleton while the membership resolves", () => {
		renderWithAuthorization(
			<MerchantCapabilityGate capability={MERCHANT_CAPABILITY.manageTeam}>
				<p>team</p>
			</MerchantCapabilityGate>,
			{ isLoading: true },
		);

		expect(screen.getByRole("status", { name: "Checking access" })).toBeTruthy();
		expect(screen.queryByText("You don't have access to this page")).toBeNull();
		expect(screen.queryByText("team")).toBeNull();
	});
});
