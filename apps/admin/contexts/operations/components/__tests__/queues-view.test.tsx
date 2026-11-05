// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { epochMs, PERMISSION, type OpsFailedJobList, type OpsQueueList } from "@workspace/shared";
import { accessibilityViolations } from "@workspace/ui/testing/axe";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatFailureRate, QueuesView } from "@/contexts/operations/components/queues-view";

const { queuesQuery, failedQuery, retryMutate, discardMutate, permissions } = vi.hoisted(() => ({
	queuesQuery: vi.fn(),
	failedQuery: vi.fn(),
	retryMutate: vi.fn(),
	discardMutate: vi.fn(),
	permissions: { granted: new Set<string>() },
}));

vi.mock("@tanstack/react-query", async (importOriginal) => ({ ...(await importOriginal<object>()), useQueryClient: (): object => ({ invalidateQueries: vi.fn() }) }));
vi.mock("@workspace/client/lib/contexts/authorization", () => ({ useAuthorization: (): object => ({ can: (slug: string): boolean => permissions.granted.has(slug) }) }));
vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({
		api: {
			operations: {
				queues: { useQuery: queuesQuery },
				queueFailedJobs: { useQuery: failedQuery },
				retryQueueJob: { useMutation: (): object => ({ mutate: retryMutate, isPending: false }) },
				discardQueueJob: { useMutation: (): object => ({ mutate: discardMutate, isPending: false }) },
			},
		},
	}),
}));

const LIST: OpsQueueList = {
	available: true,
	metricsWindowMinutes: 60,
	queues: [
		{ name: "email.send", waiting: 4, active: 1, delayed: 0, failed: 2, paused: false, completedLastHour: 18, failedLastHour: 2, failureRatePercent: 10 },
		{ name: "storage.scan", waiting: 0, active: 0, delayed: 0, failed: 0, paused: true, completedLastHour: 0, failedLastHour: 0, failureRatePercent: null },
	],
};
const FAILED: OpsFailedJobList = {
	queue: "email.send",
	total: 2,
	jobs: [
		{
			id: "job-7",
			name: "send",
			failedReason: "SMTP 554: mailbox unavailable",
			attemptsMade: 3,
			maxAttempts: 3,
			createdAt: epochMs(Date.UTC(2026, 10, 3, 9, 0)),
			failedAt: epochMs(Date.UTC(2026, 10, 3, 9, 5)),
		},
	],
};
const REASON = "The mail provider is back; send again";

beforeEach((): void => {
	queuesQuery.mockReturnValue({ data: { data: LIST } });
	failedQuery.mockReturnValue({ data: { data: FAILED } });
	permissions.granted = new Set<string>([PERMISSION.BACKGROUND_JOB.UPDATE, PERMISSION.BACKGROUND_JOB.DELETE]);
});

afterEach((): void => {
	cleanup();
	vi.clearAllMocks();
});

function openFailedJobs(): void {
	act((): void => {
		fireEvent.click(screen.getByRole("button", { name: "Failed jobs in email.send" }));
	});
}

describe("formatFailureRate", () => {
	it("reads as a percentage, or a dash when nothing finished", () => {
		expect(formatFailureRate(12.5)).toBe("12.5%");
		expect(formatFailureRate(null)).toBe("—");
	});
});

describe("QueuesView", () => {
	it("shows every queue's depth, last hour and failure rate, and which are paused", () => {
		render(<QueuesView />, { wrapper: UiKitTestProviders });
		const table = within(screen.getByRole("table", { name: "Queues" }));
		expect(table.getByText("email.send")).toBeTruthy();
		expect(table.getByText("18 done, 2 failed")).toBeTruthy();
		expect(table.getByText("10%")).toBeTruthy();
		expect(table.getByText("Paused")).toBeTruthy();
		expect(table.getByRole("button", { name: "Failed jobs in storage.scan" })).toHaveProperty("disabled", true);
	});

	it("says so where the API runs without queues", () => {
		queuesQuery.mockReturnValue({ data: { data: { available: false, metricsWindowMinutes: 60, queues: [] } } });
		render(<QueuesView />, { wrapper: UiKitTestProviders });
		expect(screen.getByText("No queues here")).toBeTruthy();
	});

	it("lists a queue's failed jobs and retries or discards one only once a reason is given", () => {
		render(<QueuesView />, { wrapper: UiKitTestProviders });
		openFailedJobs();
		expect(failedQuery).toHaveBeenCalledWith({ queueName: "email.send" });
		expect(screen.getByText("SMTP 554: mailbox unavailable")).toBeTruthy();
		expect(screen.getByText("3 of 3")).toBeTruthy();

		const retry = screen.getByRole("button", { name: "Retry job job-7" });
		expect(retry).toHaveProperty("disabled", true);
		act((): void => {
			fireEvent.change(screen.getByLabelText("Why (kept in the audit log)"), { target: { value: REASON } });
		});
		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Retry job job-7" }));
		});
		expect(retryMutate).toHaveBeenCalledWith({ queueName: "email.send", jobId: "job-7", reason: REASON });
		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Discard job job-7" }));
		});
		expect(discardMutate).toHaveBeenCalledWith({ queueName: "email.send", jobId: "job-7", reason: REASON });
	});

	it("offers no retry, discard or reason to staff who may only look", () => {
		permissions.granted = new Set();
		render(<QueuesView />, { wrapper: UiKitTestProviders });
		openFailedJobs();
		expect(screen.getByText("SMTP 554: mailbox unavailable")).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Retry job job-7" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Discard job job-7" })).toBeNull();
		expect(screen.queryByLabelText("Why (kept in the audit log)")).toBeNull();
	});

	it("has no serious accessibility problems (enhancement 3.2)", async () => {
		render(<QueuesView />, { wrapper: UiKitTestProviders });
		openFailedJobs();
		await expect(accessibilityViolations(document.body)).resolves.toStrictEqual([]);
	});
});
