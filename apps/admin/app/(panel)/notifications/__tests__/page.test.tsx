// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AdminNotificationsPage from "../page";

vi.mock("@workspace/client/lib/features/notifications/notifications-inbox", () => ({ NotificationsInbox: (): React.JSX.Element => <p>inbox</p> }));

afterEach((): void => {
	cleanup();
});

describe("/notifications (admin)", () => {
	it("renders the staff member's own inbox", () => {
		render(<AdminNotificationsPage />);

		expect(screen.getByText("inbox")).toBeDefined();
	});
});
