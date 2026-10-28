// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PERMISSION } from "@workspace/shared";

import { Can, CapabilitiesProvider, useAuthorization, useCan } from "../index";

const READ = PERMISSION.USER.READ;
const DELETE = PERMISSION.USER.DELETE;
const UPDATE = PERMISSION.USER.UPDATE;

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

	it("never lets one held action imply another, on the same resource or any other", () => {
		render(
			<CapabilitiesProvider capabilities={[UPDATE]}>
				<Can permission={READ} fallback={<div>read-denied</div>}>
					<div>read-content</div>
				</Can>
				<Can permission={PERMISSION.ORDER.READ} fallback={<div>other-resource-denied</div>}>
					<div>other-resource-content</div>
				</Can>
			</CapabilitiesProvider>,
		);

		expect(screen.getByText("read-denied")).toBeDefined();
		expect(screen.queryByText("read-content")).toBeNull();
		expect(screen.getByText("other-resource-denied")).toBeDefined();
		expect(screen.queryByText("other-resource-content")).toBeNull();
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
	function Probe({ capabilities }: { readonly capabilities: readonly string[] }): React.JSX.Element {
		return (
			<CapabilitiesProvider capabilities={capabilities}>
				<Checks />
			</CapabilitiesProvider>
		);
	}

	function Checks(): React.JSX.Element {
		const auth = useAuthorization();
		return (
			<div>
				<span>{auth.can(DELETE) ? "can-yes" : "can-no"}</span>
				<span>{auth.cannot(DELETE) ? "cannot-yes" : "cannot-no"}</span>
			</div>
		);
	}

	it("cannot is the negation of can", () => {
		render(<Probe capabilities={[]} />);

		expect(screen.getByText("can-no")).toBeDefined();
		expect(screen.getByText("cannot-yes")).toBeDefined();
	});

	it("allows exactly the held permission", () => {
		render(<Probe capabilities={[DELETE]} />);
		expect(screen.getByText("can-yes")).toBeDefined();
		cleanup();

		render(<Probe capabilities={[UPDATE]} />);
		expect(screen.getByText("can-no")).toBeDefined();
		expect(screen.getByText("cannot-yes")).toBeDefined();
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
