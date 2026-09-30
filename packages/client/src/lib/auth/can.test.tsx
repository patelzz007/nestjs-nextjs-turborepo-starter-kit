// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PERMISSION, type ResourceAuthorization } from "@workspace/shared";

import { Can, CapabilitiesProvider, useAuthorization, useCan } from "./can";

const READ = PERMISSION.USER.READ;
const DELETE = PERMISSION.USER.DELETE;
const MANAGE = PERMISSION.USER.MANAGE;

interface TestOrder {
	readonly id: string;
	readonly authorization?: ResourceAuthorization;
}

afterEach(() => {
	cleanup();
});

describe("Can component", () => {
	it("renders children when the single permission is granted", () => {
		render(
			<CapabilitiesProvider capabilities={[READ]}>
				<Can permission={READ}>
					<div>allowed-content</div>
				</Can>
			</CapabilitiesProvider>,
		);

		expect(screen.getByText("allowed-content")).toBeDefined();
	});

	it("renders fallback when the permission is missing", () => {
		render(
			<CapabilitiesProvider capabilities={[READ]}>
				<Can permission={DELETE} fallback={<div>denied-fallback</div>}>
					<div>hidden-content</div>
				</Can>
			</CapabilitiesProvider>,
		);

		expect(screen.getByText("denied-fallback")).toBeDefined();
		expect(screen.queryByText("hidden-content")).toBeNull();
	});

	it("evaluates permission lists with any semantics by default", () => {
		render(
			<CapabilitiesProvider capabilities={[DELETE]}>
				<Can permissions={[READ, DELETE]}>
					<div>any-content</div>
				</Can>
			</CapabilitiesProvider>,
		);

		expect(screen.getByText("any-content")).toBeDefined();
	});

	it("evaluates permission lists with all semantics when configured", () => {
		render(
			<CapabilitiesProvider capabilities={[DELETE]}>
				<Can permissions={[READ, DELETE]} mode="all">
					<div>all-content</div>
				</Can>
				<Can permissions={[READ, DELETE]} mode="all" fallback={<div>all-denied</div>}>
					<div>never</div>
				</Can>
			</CapabilitiesProvider>,
		);

		expect(screen.queryByText("all-content")).toBeNull();
		expect(screen.getByText("all-denied")).toBeDefined();
	});

	it("treats MANAGE on the same resource as implying every action", () => {
		render(
			<CapabilitiesProvider capabilities={[MANAGE]}>
				<Can permission={READ} fallback={<div>read-denied</div>}>
					<div>read-content</div>
				</Can>
				<Can permission={PERMISSION.ORDER.READ} fallback={<div>other-resource-denied</div>}>
					<div>other-resource-content</div>
				</Can>
			</CapabilitiesProvider>,
		);

		expect(screen.getByText("read-content")).toBeDefined();
		expect(screen.getByText("other-resource-denied")).toBeDefined();
		expect(screen.queryByText("other-resource-content")).toBeNull();
	});

	it("honours the server-evaluated resource capability and renders the fallback when denied", () => {
		const lockedOrder: TestOrder = { id: "o1", authorization: { can: { delete: false } } };
		const openOrder: TestOrder = { id: "o2", authorization: { can: { delete: true } } };

		render(
			<CapabilitiesProvider capabilities={[PERMISSION.ORDER.DELETE]}>
				<Can permission={PERMISSION.ORDER.DELETE} resource={lockedOrder} fallback={<div>locked-fallback</div>}>
					<div>locked-content</div>
				</Can>
				<Can permission={PERMISSION.ORDER.DELETE} resource={openOrder} fallback={<div>open-fallback</div>}>
					<div>open-content</div>
				</Can>
			</CapabilitiesProvider>,
		);

		expect(screen.getByText("locked-fallback")).toBeDefined();
		expect(screen.queryByText("locked-content")).toBeNull();
		expect(screen.getByText("open-content")).toBeDefined();
	});
});

describe("useCan hook", () => {
	it("returns a deny-all checker when no provider is present (fail closed)", () => {
		function Probe(): React.JSX.Element {
			const { can } = useCan();
			return <div>{can(READ) ? "allowed" : "denied"}</div>;
		}

		render(<Probe />);

		expect(screen.getByText("denied")).toBeDefined();
	});

	it("checks a single capability", () => {
		function Probe(): React.JSX.Element {
			const { can } = useCan();
			return <div>{can(READ) ? "allowed" : "denied"}</div>;
		}

		render(
			<CapabilitiesProvider capabilities={[READ]}>
				<Probe />
			</CapabilitiesProvider>,
		);

		expect(screen.getByText("allowed")).toBeDefined();
	});

	it("supports all/any list checks", () => {
		function Probe(): React.JSX.Element {
			const { canAll, canAny } = useCan();
			return (
				<div>
					<span>{canAll([READ, DELETE]) ? "all-yes" : "all-no"}</span>
					<span>{canAny([READ, DELETE]) ? "any-yes" : "any-no"}</span>
				</div>
			);
		}

		render(
			<CapabilitiesProvider capabilities={[READ]}>
				<Probe />
			</CapabilitiesProvider>,
		);

		expect(screen.getByText("all-no")).toBeDefined();
		expect(screen.getByText("any-yes")).toBeDefined();
	});
});

describe("useAuthorization hook", () => {
	interface ProbeProps {
		readonly capabilities: readonly string[];
		readonly order?: TestOrder;
	}

	function Probe({ capabilities, order }: ProbeProps): React.JSX.Element {
		return (
			<CapabilitiesProvider capabilities={capabilities}>
				<Checks order={order} />
			</CapabilitiesProvider>
		);
	}

	function Checks({ order }: { readonly order?: TestOrder }): React.JSX.Element {
		const auth = useAuthorization();
		return (
			<div>
				<span>{auth.can(PERMISSION.ORDER.DELETE, order) ? "can-yes" : "can-no"}</span>
				<span>{auth.cannot(PERMISSION.ORDER.DELETE, order) ? "cannot-yes" : "cannot-no"}</span>
			</div>
		);
	}

	it("cannot is the negation of can", () => {
		render(<Probe capabilities={[]} />);

		expect(screen.getByText("can-no")).toBeDefined();
		expect(screen.getByText("cannot-yes")).toBeDefined();
	});

	it("denies when the server says false even though the global permission is held", () => {
		render(<Probe capabilities={[PERMISSION.ORDER.DELETE]} order={{ id: "o1", authorization: { can: { delete: false } } }} />);

		expect(screen.getByText("can-no")).toBeDefined();
		expect(screen.getByText("cannot-yes")).toBeDefined();
	});

	it("denies when the server map has no entry for the action", () => {
		render(<Probe capabilities={[PERMISSION.ORDER.DELETE]} order={{ id: "o1", authorization: { can: { read: true } } }} />);

		expect(screen.getByText("can-no")).toBeDefined();
	});

	it("trusts the server decision for the resource even without the global permission (e.g. an ACL grant)", () => {
		render(<Probe capabilities={[PERMISSION.ORDER.READ]} order={{ id: "o1", authorization: { can: { delete: true } } }} />);

		expect(screen.getByText("can-yes")).toBeDefined();
	});

	it("denies on the resource when the server denies, even with the global permission", () => {
		render(<Probe capabilities={[PERMISSION.ORDER.DELETE]} order={{ id: "o1", authorization: { can: { delete: false } } }} />);

		expect(screen.getByText("can-no")).toBeDefined();
	});

	it("allows when MANAGE implies the action and the server allows it on the resource", () => {
		render(<Probe capabilities={[PERMISSION.ORDER.MANAGE]} order={{ id: "o1", authorization: { can: { delete: true } } }} />);

		expect(screen.getByText("can-yes")).toBeDefined();
		expect(screen.getByText("cannot-no")).toBeDefined();
	});

	it("falls back to the global check for resources without an authorization block", () => {
		render(<Probe capabilities={[PERMISSION.ORDER.DELETE]} order={{ id: "o1" }} />);

		expect(screen.getByText("can-yes")).toBeDefined();
	});

	it("useCan exposes the same checker", () => {
		function Legacy(): React.JSX.Element {
			const { cannot } = useCan();
			return <div>{cannot(READ) ? "legacy-denied" : "legacy-allowed"}</div>;
		}

		render(
			<CapabilitiesProvider capabilities={[READ]}>
				<Legacy />
			</CapabilitiesProvider>,
		);

		expect(screen.getByText("legacy-allowed")).toBeDefined();
	});
});
