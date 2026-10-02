// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { CapabilitiesProvider } from "@workspace/client/lib/auth/can";
import { PERMISSION, type CapabilitySlug } from "@workspace/shared";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AccessControlPanel from "../access-control-panel";

interface ListQueryStub {
	readonly useQuery: () => { readonly data: { readonly data: { readonly items: readonly [] } }; readonly isError: boolean };
}

interface AuthStub {
	readonly api: {
		readonly admin: {
			readonly roles: { readonly list: ListQueryStub };
			readonly permissions: { readonly list: ListQueryStub; readonly check: { readonly useMutation: () => { readonly mutate: () => void; readonly isPending: boolean } } };
		};
	};
}

vi.mock("@workspace/client/lib/auth", () => {
	const emptyList: ListQueryStub = { useQuery: () => ({ data: { data: { items: [] } }, isError: false }) };
	const auth: AuthStub = {
		api: {
			admin: {
				roles: { list: emptyList },
				permissions: { list: emptyList, check: { useMutation: () => ({ mutate: () => undefined, isPending: false }) } },
			},
		},
	};
	return { useAuth: (): AuthStub => auth };
});

function renderPanel(capabilities: readonly CapabilitySlug[]): void {
	render(
		<CapabilitiesProvider capabilities={capabilities}>
			<AccessControlPanel />
		</CapabilitiesProvider>,
	);
}

afterEach(() => {
	cleanup();
});

describe("AccessControlPanel authorization", () => {
	it("shows every tab when all three permissions are granted", () => {
		renderPanel([PERMISSION.ROLE.LIST, PERMISSION.PERMISSION.LIST, PERMISSION.PERMISSION.READ]);
		expect(screen.getByRole("tab", { name: /Roles/ })).toBeDefined();
		expect(screen.getByRole("tab", { name: /Permissions/ })).toBeDefined();
		expect(screen.getByRole("tab", { name: "Permission checker" })).toBeDefined();
	});

	it("shows only the checker tab (selected) for permission.read alone", () => {
		renderPanel([PERMISSION.PERMISSION.READ]);
		expect(screen.queryByRole("tab", { name: /Roles/ })).toBeNull();
		expect(screen.queryByRole("tab", { name: /Permissions/ })).toBeNull();
		expect(screen.getByRole("tab", { name: "Permission checker" }).getAttribute("aria-selected")).toBe("true");
	});

	it("selects the first permitted tab — permissions when roles cannot be listed", () => {
		renderPanel([PERMISSION.PERMISSION.LIST, PERMISSION.PERMISSION.READ]);
		expect(screen.queryByRole("tab", { name: /Roles/ })).toBeNull();
		expect(screen.getByRole("tab", { name: /Permissions/ }).getAttribute("aria-selected")).toBe("true");
		expect(screen.getByRole("tab", { name: "Permission checker" }).getAttribute("aria-selected")).toBe("false");
	});

	it("selects the roles tab first when every view is permitted", () => {
		renderPanel([PERMISSION.ROLE.LIST, PERMISSION.PERMISSION.LIST, PERMISSION.PERMISSION.READ]);
		expect(screen.getByRole("tab", { name: /Roles/ }).getAttribute("aria-selected")).toBe("true");
	});
});
