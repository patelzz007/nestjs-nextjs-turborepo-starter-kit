// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { MembershipRole } from "@workspace/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LeaveTenantCard } from "../leave-tenant-card";

const { roleHolder } = vi.hoisted(() => {
	const holder: { current: MembershipRole | undefined } = { current: undefined };
	return { roleHolder: holder };
});

vi.mock("next/navigation", () => ({ useRouter: (): object => ({ push: vi.fn() }) }));

vi.mock("@/features/tenant-context/facade", () => ({
	useActiveMembership: (): object => ({ membership: roleHolder.current === undefined ? undefined : { role: roleHolder.current }, isLoading: false }),
	useActiveTenantName: (): string => "Acme Coffee",
}));

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({ api: { tenants: { leaveTenant: { useMutation: (): object => ({ mutate: vi.fn(), isPending: false }) } } } }),
}));

function renderAs(role: MembershipRole | undefined): void {
	roleHolder.current = role;
	render(
		<QueryClientProvider client={new QueryClient()}>
			<LeaveTenantCard tenantSlug="acme-coffee" />
		</QueryClientProvider>,
	);
}

afterEach(() => {
	cleanup();
});

describe("LeaveTenantCard", () => {
	it.each(["MANAGER", "CASHIER", "CASHIER"] satisfies MembershipRole[])("offers a %s to leave", (role) => {
		renderAs(role);

		expect(screen.getByRole("button", { name: "Leave this tenant" })).toBeDefined();
	});

	it("never offers the owner or a non-member to leave", () => {
		renderAs("OWNER");
		expect(screen.queryByRole("button")).toBeNull();
		cleanup();

		renderAs(undefined);
		expect(screen.queryByRole("button")).toBeNull();
	});
});
