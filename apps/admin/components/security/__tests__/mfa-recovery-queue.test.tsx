// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AdminMfaRecoveryRequest } from "@workspace/shared";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MfaRecoveryQueue } from "@/components/security/mfa-recovery-queue";

/** Only the request fields the queue renders. */
interface RecoveryRowStub {
	readonly id: string;
	readonly userId: string;
	readonly userFullName: string;
	readonly userEmail: string;
	readonly status: string;
	readonly requestedAt: number;
}

const { requestsQuery, FIRST_ID, SECOND_ID } = vi.hoisted(() => ({
	requestsQuery: vi.fn(),
	FIRST_ID: "5a1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a01",
	SECOND_ID: "5a1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a02",
}));

// The queue reads its state from the address bar, as Next.js's
// `useSearchParams` does once the History API integration has synced it.
vi.mock("next/navigation", () => ({
	useRouter: (): { readonly push: () => void } => ({ push: () => undefined }),
	useSearchParams: (): URLSearchParams => new URLSearchParams(window.location.search),
}));

// The review panel has its own tests; here it only reports which request it shows.
vi.mock("@/components/security/mfa-recovery-review-panel", () => ({
	MfaRecoveryReviewPanel: ({ request }: { readonly request: AdminMfaRecoveryRequest }): React.JSX.Element => <p>Reviewing {request.userEmail}</p>,
}));

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): object => ({ api: { auth: { adminMfaRecoveryRequests: { useQuery: requestsQuery } } } }),
}));

const PATH = "/users/mfa-recovery";
const ROWS: readonly RecoveryRowStub[] = [
	{ id: FIRST_ID, userId: "u-1", userFullName: "Jane Doe", userEmail: "jane@example.com", status: "PENDING", requestedAt: 1_790_000_000_000 },
	{ id: SECOND_ID, userId: "u-2", userFullName: "Bob Roe", userEmail: "bob@example.com", status: "PENDING", requestedAt: 1_790_000_100_000 },
];

beforeEach((): void => {
	window.history.replaceState(null, "", PATH);
	requestsQuery.mockReturnValue({ data: { data: ROWS }, isLoading: false, isFetching: false, refetch: (): Promise<void> => Promise.resolve() });
});

afterEach((): void => {
	cleanup();
	requestsQuery.mockReset();
	vi.restoreAllMocks();
});

describe("MfaRecoveryQueue URL state", () => {
	it("opens on pending requests and reviews the first one", () => {
		render(<MfaRecoveryQueue />);

		expect(requestsQuery).toHaveBeenLastCalledWith({ page: 1, limit: 20, filter: { status: { eq: "PENDING" } } }, expect.anything());
		expect(screen.getByText("Reviewing jane@example.com")).toBeDefined();
	});

	it("sends no status filter for ?filter[status]=all", () => {
		window.history.replaceState(null, "", `${PATH}?filter[status]=all`);
		render(<MfaRecoveryQueue />);

		expect(requestsQuery).toHaveBeenLastCalledWith({ page: 1, limit: 20 }, expect.anything());
	});

	it("reviews the request named by ?requestId=", () => {
		window.history.replaceState(null, "", `${PATH}?requestId=${SECOND_ID}`);
		render(<MfaRecoveryQueue />);

		expect(screen.getByText("Reviewing bob@example.com")).toBeDefined();
	});

	it("pushes a clicked row as the selection and follows it", () => {
		const pushState = vi.spyOn(window.history, "pushState");
		const view = render(<MfaRecoveryQueue />);

		fireEvent.click(screen.getByText("Bob Roe"));

		expect(pushState).toHaveBeenCalledTimes(1);
		expect(window.location.search).toBe(`?requestId=${SECOND_ID}`);
		view.rerender(<MfaRecoveryQueue />);
		expect(screen.getByText("Reviewing bob@example.com")).toBeDefined();
	});
});
