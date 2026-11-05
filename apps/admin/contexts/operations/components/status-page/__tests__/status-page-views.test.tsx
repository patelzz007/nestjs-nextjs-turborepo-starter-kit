// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { epochMs, PERMISSION, type StatusIncident } from "@workspace/shared";
import { accessibilityViolations } from "@workspace/ui/testing/axe";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NewStatusIncidentForm } from "@/contexts/operations/components/status-page/new-status-incident-form";
import { StatusIncidentDetail } from "@/contexts/operations/components/status-page/status-incident-detail";
import { StatusIncidentsView } from "@/contexts/operations/components/status-page/status-incidents-view";

const { listQuery, detailQuery, createMutate, postMutate, push, permissions } = vi.hoisted(() => ({
	listQuery: vi.fn(),
	detailQuery: vi.fn(),
	createMutate: vi.fn(),
	postMutate: vi.fn(),
	push: vi.fn(),
	permissions: { granted: new Set<string>() },
}));

vi.mock("next/navigation", () => ({ useRouter: (): object => ({ push }) }));
vi.mock("@tanstack/react-query", async (importOriginal) => ({ ...(await importOriginal<object>()), useQueryClient: (): object => ({ invalidateQueries: vi.fn() }) }));
vi.mock("@workspace/client/lib/contexts/authorization", () => ({ useAuthorization: (): object => ({ can: (slug: string): boolean => permissions.granted.has(slug) }) }));
vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({
		api: {
			operations: {
				statusIncidents: { useQuery: listQuery },
				statusIncident: { useQuery: detailQuery },
				createStatusIncident: { useMutation: (): object => ({ mutateAsync: createMutate, isPending: false }) },
				postStatusIncidentUpdate: { useMutation: (): object => ({ mutateAsync: postMutate, isPending: false }) },
			},
		},
	}),
}));

const INCIDENT: StatusIncident = {
	id: "0190f0e0-0000-7000-8000-000000000001",
	title: "Emails are delayed",
	impact: "MINOR",
	state: "IDENTIFIED",
	components: ["background-jobs"],
	startedAt: epochMs(Date.UTC(2026, 10, 3, 9, 0)),
	resolvedAt: null,
	openedByName: "Sam Staff",
	updates: [
		{
			id: "0190f0e0-0000-7000-8000-0000000000a2",
			state: "IDENTIFIED",
			message: "The mail provider is slow.",
			postedAt: epochMs(Date.UTC(2026, 10, 3, 9, 20)),
			postedByName: "Sam Staff",
		},
		{
			id: "0190f0e0-0000-7000-8000-0000000000a1",
			state: "INVESTIGATING",
			message: "Emails are arriving late.",
			postedAt: epochMs(Date.UTC(2026, 10, 3, 9, 0)),
			postedByName: "Sam Staff",
		},
	],
};

beforeEach((): void => {
	listQuery.mockReturnValue({ data: { data: { incidents: [INCIDENT] } } });
	detailQuery.mockReturnValue({ data: { data: INCIDENT } });
	createMutate.mockResolvedValue({ data: INCIDENT });
	postMutate.mockResolvedValue({ data: INCIDENT });
	permissions.granted = new Set<string>([PERMISSION.STATUS_INCIDENT.CREATE, PERMISSION.STATUS_INCIDENT.UPDATE]);
});

afterEach((): void => {
	cleanup();
	vi.clearAllMocks();
});

describe("StatusIncidentsView", () => {
	it("lists incidents with where they stand, and offers opening one only to staff who may", () => {
		const { unmount } = render(<StatusIncidentsView />, { wrapper: UiKitTestProviders });
		const table = within(screen.getByRole("table", { name: "Incidents" }));
		expect(table.getByRole("link", { name: "Emails are delayed" }).getAttribute("href")).toBe("/operations/status/0190f0e0-0000-7000-8000-000000000001");
		expect(table.getByText("Cause found")).toBeTruthy();
		expect(table.getByText("Emails, notifications and background work")).toBeTruthy();
		// A link styled as a button: Base UI gives it the button role.
		expect(screen.getByRole("button", { name: "Open an incident" }).getAttribute("href")).toBe("/operations/status/new");
		unmount();

		permissions.granted = new Set();
		render(<StatusIncidentsView />, { wrapper: UiKitTestProviders });
		expect(screen.queryByRole("button", { name: "Open an incident" })).toBeNull();
	});
});

describe("StatusIncidentDetail", () => {
	it("shows the updates newest first and posts the next one", async () => {
		render(<StatusIncidentDetail incidentId={INCIDENT.id} />, { wrapper: UiKitTestProviders });
		const updates = within(screen.getByRole("list", { name: "Updates" })).getAllByRole("listitem");
		expect(updates.map((item) => item.textContent)).toStrictEqual([
			expect.stringContaining("The mail provider is slow."),
			expect.stringContaining("Emails are arriving late."),
		]);

		act((): void => {
			fireEvent.change(screen.getByLabelText("Message"), { target: { value: "A fix is out; we're watching it." } });
		});
		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Post update" }));
		});
		await waitFor((): void => {
			expect(postMutate).toHaveBeenCalledWith({ incidentId: INCIDENT.id, state: "IDENTIFIED", message: "A fix is out; we're watching it." });
		});
	});

	it("refuses a message too short to tell customers anything", async () => {
		render(<StatusIncidentDetail incidentId={INCIDENT.id} />, { wrapper: UiKitTestProviders });
		act((): void => {
			fireEvent.change(screen.getByLabelText("Message"), { target: { value: "ok" } });
		});
		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Post update" }));
		});
		await waitFor((): void => {
			expect(screen.getByLabelText("Message").getAttribute("aria-invalid")).toBe("true");
		});
		expect(postMutate).not.toHaveBeenCalled();
	});

	it("offers no update form once resolved, or to staff who may only look", () => {
		detailQuery.mockReturnValue({ data: { data: { ...INCIDENT, state: "RESOLVED", resolvedAt: epochMs(Date.UTC(2026, 10, 3, 10, 0)) } } });
		const { unmount } = render(<StatusIncidentDetail incidentId={INCIDENT.id} />, { wrapper: UiKitTestProviders });
		expect(screen.queryByRole("button", { name: "Post update" })).toBeNull();
		unmount();

		detailQuery.mockReturnValue({ data: { data: INCIDENT } });
		permissions.granted = new Set();
		render(<StatusIncidentDetail incidentId={INCIDENT.id} />, { wrapper: UiKitTestProviders });
		expect(screen.queryByRole("button", { name: "Post update" })).toBeNull();
	});

	it("has no serious accessibility problems (enhancement 3.2)", async () => {
		render(<StatusIncidentDetail incidentId={INCIDENT.id} />, { wrapper: UiKitTestProviders });
		await expect(accessibilityViolations(document.body)).resolves.toStrictEqual([]);
	});
});

describe("NewStatusIncidentForm", () => {
	it("opens an incident on the chosen parts and goes to it", async () => {
		render(<NewStatusIncidentForm />, { wrapper: UiKitTestProviders });
		act((): void => {
			fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Emails are delayed" } });
			fireEvent.change(screen.getByLabelText("First update"), { target: { value: "Emails are arriving late. We're on it." } });
		});
		act((): void => {
			fireEvent.click(screen.getByRole("checkbox", { name: "Emails, notifications and background work" }));
		});
		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Open incident" }));
		});
		await waitFor((): void => {
			expect(createMutate).toHaveBeenCalledWith({
				title: "Emails are delayed",
				impact: "MINOR",
				components: ["background-jobs"],
				message: "Emails are arriving late. We're on it.",
			});
		});
	});

	it("needs at least one affected part", async () => {
		render(<NewStatusIncidentForm />, { wrapper: UiKitTestProviders });
		act((): void => {
			fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Emails are delayed" } });
			fireEvent.change(screen.getByLabelText("First update"), { target: { value: "Emails are arriving late. We're on it." } });
		});
		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Open incident" }));
		});
		await waitFor((): void => {
			expect(screen.getByRole("group", { name: "What's affected" }).getAttribute("aria-invalid")).toBe("true");
		});
		expect(createMutate).not.toHaveBeenCalled();
	});

	it("has no serious accessibility problems (enhancement 3.2)", async () => {
		render(<NewStatusIncidentForm />, { wrapper: UiKitTestProviders });
		await expect(accessibilityViolations(document.body)).resolves.toStrictEqual([]);
	});
});
