// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import MerchantNotificationsPage from "../page";

const { guardTenantPage } = vi.hoisted(() => ({ guardTenantPage: vi.fn<(tenantSlug: string, route: string) => Promise<React.JSX.Element | null>>() }));

vi.mock("@/contexts/tenancy/lib/tenant/tenant-page-guard", () => ({ guardTenantPage }));
vi.mock("@workspace/client/lib/features/notifications/notifications-inbox", () => ({ NotificationsInbox: (): React.JSX.Element => <p>inbox</p> }));

const PARAMS = Promise.resolve({ tenantSlug: "sunrise-cafe" });

afterEach((): void => {
	cleanup();
	vi.resetAllMocks();
});

describe("/t/[tenantSlug]/notifications", () => {
	it("guards the tenant page, then renders the member's merchant inbox", async () => {
		guardTenantPage.mockResolvedValue(null);

		render(await MerchantNotificationsPage({ params: PARAMS }));

		expect(guardTenantPage).toHaveBeenCalledWith("sunrise-cafe", "/notifications");
		expect(screen.getByText("inbox")).toBeDefined();
	});

	it("renders the guard's answer instead when the member may not open the tenant", async () => {
		guardTenantPage.mockResolvedValue(<p>not a member</p>);

		render(await MerchantNotificationsPage({ params: PARAMS }));

		expect(screen.getByText("not a member")).toBeDefined();
		expect(screen.queryByText("inbox")).toBeNull();
	});
});
