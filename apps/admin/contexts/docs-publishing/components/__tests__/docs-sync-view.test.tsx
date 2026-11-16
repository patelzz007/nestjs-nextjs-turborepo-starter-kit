// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ClientTestProviders } from "@workspace/client/testing/client-test-providers";
import { ApiPaginatedMetaSchema, DocsSyncOverviewSchema, DocsSyncRunSummarySchema, type DocsSyncOverview, type DocsSyncRunSummary } from "@workspace/shared";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DocsSyncView from "../docs-sync-view";

const { overviewQuery, runsQuery, startMutate, revealMutate, can, push } = vi.hoisted(() => ({
	overviewQuery: vi.fn(),
	runsQuery: vi.fn(),
	startMutate: vi.fn(),
	revealMutate: vi.fn(),
	can: vi.fn(),
	push: vi.fn(),
}));

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({
		api: {
			docsPublishing: {
				overview: { useQuery: overviewQuery },
				runs: { useQuery: runsQuery },
				startSync: { useMutation: (): object => ({ mutate: startMutate, isPending: false }) },
				revealHandshake: { useMutation: (): object => ({ mutate: revealMutate, isPending: false }) },
			},
		},
	}),
}));

vi.mock("@workspace/client/lib/contexts/authorization", () => ({ useAuthorization: (): object => ({ can }) }));

vi.mock("next/navigation", async (importOriginal) => ({
	...(await importOriginal<typeof import("next/navigation")>()),
	useRouter: (): object => ({ push }),
}));

const META = ApiPaginatedMetaSchema.parse({
	correlationId: "test",
	timestamp: 1_790_000_000_000,
	limit: 25,
	total: 1,
	page: 1,
	totalPages: 1,
	nextCursor: null,
	hasNext: false,
	hasPrevious: false,
});

const RUN: DocsSyncRunSummary = DocsSyncRunSummarySchema.parse({
	id: "0193f3a8-3b1c-7c4e-9d2a-5b6c7d8e9f01",
	runId: "run-1",
	source: "NOTION",
	trigger: "WEBHOOK",
	status: "PARTIAL",
	converterVersion: 1,
	pagesProcessed: 2,
	pagesUnchanged: 183,
	pagesRemoved: 0,
	pagesHeldBack: 1,
	warnings: 0,
	errorSummary: null,
	pullRequestUrl: null,
	commitSha: null,
	startedAt: 1_790_000_000_000,
	finishedAt: 1_790_000_042_000,
});

function overview(overrides: Partial<DocsSyncOverview> = {}): DocsSyncOverview {
	return DocsSyncOverviewSchema.parse({
		webhookConfigured: true,
		dispatchConfigured: true,
		reportingConfigured: true,
		handshakePending: false,
		latestRun: RUN,
		latestGoodRun: null,
		...overrides,
	});
}

function show(): void {
	render(
		<QueryClientProvider client={new QueryClient()}>
			<DocsSyncView />
		</QueryClientProvider>,
		{ wrapper: ClientTestProviders },
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	can.mockReturnValue(true);
	overviewQuery.mockReturnValue({ data: { data: overview() }, error: null });
	runsQuery.mockReturnValue({ data: { data: [RUN], meta: META }, isLoading: false, isFetching: false, error: null });
});

afterEach(cleanup);

describe("DocsSyncView", () => {
	it("lists runs and what each one did", () => {
		show();

		expect(screen.getByRole("heading", { name: "Docs sync" })).toBeTruthy();
		expect(screen.getAllByText("2 written · 1 held back").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Page change").length).toBeGreaterThan(0);
	});

	it("starts a sync, and a full rebuild", () => {
		show();

		fireEvent.click(screen.getByRole("button", { name: "Sync now" }));
		fireEvent.click(screen.getByRole("button", { name: "Rebuild all pages" }));

		expect(startMutate.mock.calls).toEqual([[{ full: false }], [{ full: true }]]);
	});

	it("disables starting a sync without the permission", () => {
		can.mockReturnValue(false);
		show();

		expect(screen.getByRole<HTMLButtonElement>("button", { name: "Sync now" }).disabled).toBe(true);
	});

	it("disables starting a sync when this server has no credential, and says what is missing", () => {
		overviewQuery.mockReturnValue({ data: { data: overview({ dispatchConfigured: false }) }, error: null });
		show();

		expect(screen.getByRole<HTMLButtonElement>("button", { name: "Sync now" }).disabled).toBe(true);
		expect(screen.getByText("Not set")).toBeTruthy();
	});

	it("offers the waiting token only when Notion sent one", () => {
		show();
		expect(screen.queryByRole("button", { name: "Show token" })).toBeNull();
		cleanup();

		overviewQuery.mockReturnValue({ data: { data: overview({ handshakePending: true }) }, error: null });
		show();
		fireEvent.click(screen.getByRole("button", { name: "Show token" }));

		expect(revealMutate).toHaveBeenCalledWith({});
	});

	it("says so when nothing has reported yet", () => {
		overviewQuery.mockReturnValue({ data: { data: overview({ latestRun: null }) }, error: null });
		show();

		expect(screen.getByText("No sync has reported yet")).toBeTruthy();
	});

	it("shows an error when the API cannot be reached", () => {
		overviewQuery.mockReturnValue({ data: undefined, error: new Error("down") });
		runsQuery.mockReturnValue({ data: undefined, isLoading: false, isFetching: false, error: new Error("down") });
		show();

		expect(screen.getByText(/Failed to load the docs sync/u)).toBeTruthy();
	});
});
