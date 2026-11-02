// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ROUTES } from "@/lib/routes";

import DashboardNotificationsPage from "../page";

const { guardWebPage } = vi.hoisted(() => ({ guardWebPage: vi.fn<(returnPath: string) => Promise<void>>() }));

vi.mock("@/contexts/identity/lib/page-guard", () => ({ guardWebPage }));
vi.mock("@/contexts/identity/components/access-gate", () => ({ AccessGate: ({ children }: { readonly children: React.ReactNode }): React.JSX.Element => <>{children}</> }));
vi.mock("@workspace/client/lib/features/notifications/notifications-inbox", () => ({ NotificationsInbox: (): React.JSX.Element => <p>inbox</p> }));

beforeEach((): void => {
	guardWebPage.mockResolvedValue(undefined);
});

afterEach((): void => {
	cleanup();
	vi.resetAllMocks();
});

describe("/dashboard/notifications", () => {
	it("guards the page on the server, then renders the customer inbox", async () => {
		render(await DashboardNotificationsPage());

		expect(guardWebPage).toHaveBeenCalledWith(ROUTES.dashboard.notifications);
		expect(screen.getByText("inbox")).toBeDefined();
	});
});
