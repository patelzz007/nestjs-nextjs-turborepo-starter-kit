// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MERCHANT_CAPABILITY, PERMISSION, type CapabilitySlug } from "@workspace/shared";

import { Can, SessionAbilityProvider, useAbility } from "../index";

afterEach(() => {
	cleanup();
});

function Platform({ capabilities, children }: { readonly capabilities: readonly CapabilitySlug[]; readonly children: React.ReactNode }): React.JSX.Element {
	return (
		<SessionAbilityProvider capabilities={capabilities} namespace="platform">
			{children}
		</SessionAbilityProvider>
	);
}

describe("<Can>", () => {
	it("renders children when the session holds the permission", () => {
		render(
			<Platform capabilities={[PERMISSION.USER.READ]}>
				<Can I="READ" a="USER">
					<div>allowed-content</div>
				</Can>
			</Platform>,
		);
		expect(screen.getByText("allowed-content")).toBeDefined();
	});

	it("hides children when it does not, and denies everything for an empty session", () => {
		render(
			<Platform capabilities={[]}>
				<Can I="READ" a="USER">
					<div>hidden-content</div>
				</Can>
			</Platform>,
		);
		expect(screen.queryByText("hidden-content")).toBeNull();
	});

	it("renders a fallback through the render function", () => {
		render(
			<Platform capabilities={[PERMISSION.USER.READ]}>
				<Can I="DELETE" a="USER" passThrough>
					{({ isAllowed }) => (isAllowed ? <div>delete</div> : <div>denied-fallback</div>)}
				</Can>
			</Platform>,
		);
		expect(screen.getByText("denied-fallback")).toBeDefined();
	});

	it("never lets one held action imply another, on the same resource or any other", () => {
		render(
			<Platform capabilities={[PERMISSION.USER.UPDATE]}>
				<Can I="READ" a="USER">
					<div>read-content</div>
				</Can>
				<Can I="UPDATE" a="ORDER">
					<div>other-resource-content</div>
				</Can>
				<Can not I="READ" a="USER">
					<div>read-denied</div>
				</Can>
			</Platform>,
		);
		expect(screen.queryByText("read-content")).toBeNull();
		expect(screen.queryByText("other-resource-content")).toBeNull();
		expect(screen.getByText("read-denied")).toBeDefined();
	});

	it("reads merchant capabilities in the merchant namespace as the permissions behind them", () => {
		render(
			<SessionAbilityProvider capabilities={[MERCHANT_CAPABILITY.manageTeam]} namespace="merchant">
				<Can I="UPDATE" a="MEMBER">
					<div>team</div>
				</Can>
			</SessionAbilityProvider>,
		);
		expect(screen.getByText("team")).toBeDefined();
	});
});

describe("useAbility", () => {
	function Probe(): React.JSX.Element {
		const ability = useAbility();
		return <div>{ability.can("READ", "USER") ? "allowed" : "denied"}</div>;
	}

	it("checks imperatively", () => {
		render(
			<Platform capabilities={[PERMISSION.USER.READ]}>
				<Probe />
			</Platform>,
		);
		expect(screen.getByText("allowed")).toBeDefined();
	});

	it("follows a new capability list: a sign-out or tenant switch replaces the ability", () => {
		const view = render(
			<Platform capabilities={[PERMISSION.USER.READ]}>
				<Probe />
			</Platform>,
		);
		expect(screen.getByText("allowed")).toBeDefined();
		view.rerender(
			<Platform capabilities={[]}>
				<Probe />
			</Platform>,
		);
		expect(screen.getByText("denied")).toBeDefined();
	});

	it("allows nothing outside a provider (fails closed), and does not crash the page", () => {
		render(<Probe />);
		expect(screen.getByText("denied")).toBeDefined();
	});
});

describe("outside a provider", () => {
	it("hides what <Can> guards and shows what `not` guards", () => {
		render(
			<>
				<Can I="READ" a="USER">
					<div>guarded</div>
				</Can>
				<Can not I="READ" a="USER">
					<div>shown-when-denied</div>
				</Can>
			</>,
		);
		expect(screen.queryByText("guarded")).toBeNull();
		expect(screen.getByText("shown-when-denied")).toBeDefined();
	});
});
