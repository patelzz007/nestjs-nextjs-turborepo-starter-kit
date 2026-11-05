// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { epochMs, type PublicStatusPage } from "@workspace/shared";
import { accessibilityViolations } from "@workspace/ui/testing/axe";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PublicStatusView } from "@/contexts/operations/components/public-status-view";

const { statusQuery } = vi.hoisted(() => ({ statusQuery: vi.fn() }));

vi.mock("@workspace/client/lib/contexts/identity", () => ({ useAuth: (): object => ({ api: { operations: { publicStatus: { useQuery: statusQuery } } } }) }));

const AT = epochMs(Date.UTC(2026, 10, 3, 9, 0));
const PAGE: PublicStatusPage = {
	overall: "DEGRADED",
	checkedAt: AT,
	components: [
		{ key: "api", label: "Website, apps and API", status: "OPERATIONAL" },
		{ key: "database", label: "Accounts and data", status: "OPERATIONAL" },
		{ key: "background-jobs", label: "Emails, notifications and background work", status: "DEGRADED" },
	],
	open: [
		{
			id: "0190f0e0-0000-7000-8000-000000000001",
			title: "Emails are delayed",
			impact: "MINOR",
			state: "IDENTIFIED",
			components: ["background-jobs"],
			startedAt: AT,
			resolvedAt: null,
			updates: [
				{ state: "IDENTIFIED", message: "The mail provider is slow. Nothing is lost.", postedAt: epochMs(AT + 600_000) },
				{ state: "INVESTIGATING", message: "Emails are arriving late.", postedAt: AT },
			],
		},
	],
	recent: [],
};

beforeEach((): void => {
	statusQuery.mockReturnValue({ data: { data: PAGE }, isError: false });
});

afterEach((): void => {
	cleanup();
	vi.clearAllMocks();
});

describe("PublicStatusView", () => {
	it("says how the service is, each part, and what is happening now with its updates newest first", () => {
		render(<PublicStatusView />, { wrapper: UiKitTestProviders });
		expect(screen.getByRole("heading", { name: "Some things are slower than usual" })).toBeTruthy();
		const parts = within(screen.getByRole("list", { name: "Each part of the service" })).getAllByRole("listitem");
		expect(parts.map((item) => item.textContent)).toStrictEqual([
			"Website, apps and APIWorking",
			"Accounts and dataWorking",
			"Emails, notifications and background workSlower than usual",
		]);
		expect(screen.getByText("Happening now")).toBeTruthy();
		const updates = within(screen.getByRole("list", { name: "Updates on Emails are delayed" })).getAllByRole("listitem");
		expect(updates.at(0)?.textContent).toContain("The mail provider is slow.");
		expect(screen.getByText("Nothing went wrong in the last 7 days.")).toBeTruthy();
	});

	it("says everything is working when it is, with no 'happening now'", () => {
		statusQuery.mockReturnValue({ data: { data: { ...PAGE, overall: "OPERATIONAL", open: [] } }, isError: false });
		render(<PublicStatusView />, { wrapper: UiKitTestProviders });
		expect(screen.getByRole("heading", { name: "Everything is working" })).toBeTruthy();
		expect(screen.queryByText("Happening now")).toBeNull();
	});

	it("says so plainly when the status itself can't be loaded", () => {
		statusQuery.mockReturnValue({ data: undefined, isError: true });
		render(<PublicStatusView />, { wrapper: UiKitTestProviders });
		expect(screen.getByText("We can't load the status right now")).toBeTruthy();
	});

	it("has no serious accessibility problems (enhancement 3.2)", async () => {
		render(<PublicStatusView />, { wrapper: UiKitTestProviders });
		await expect(accessibilityViolations(document.body)).resolves.toStrictEqual([]);
	});
});
