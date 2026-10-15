// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, type QueryKey } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { auditTrailEventsUrl, useAuditTrailLive } from "@/lib/notifications/audit-trail-live";

// The hook refreshes the session through the auth facade after a terminal close (covered in reconnecting-event-stream.test.ts).
// Stable across renders, like the facade's memoized commands.
const { authCommands } = vi.hoisted(() => ({ authCommands: { refreshSession: (): Promise<"ok"> => Promise.resolve("ok") } }));
vi.mock("@workspace/client/lib/auth", () => ({ useAuthCommands: (): typeof authCommands => authCommands }));

/** EventSource ready states (spec-defined). */
const READY_CONNECTING = 0;
const READY_OPEN = 1;
const READY_CLOSED = 2;

/** A controllable stand-in for the browser's EventSource (jsdom has none). */
class FakeEventSource extends EventTarget {
	public static latest: FakeEventSource | null = null;
	public static opened = 0;
	public readyState: number = READY_CONNECTING;
	public readonly url: string;

	public constructor(url: string) {
		super();
		this.url = url;
		FakeEventSource.latest = this;
		FakeEventSource.opened += 1;
	}

	public close(): void {
		this.readyState = READY_CLOSED;
	}
}

const FIRST_PAGE_QUERY = { page: 1, limit: 50 };
const SECOND_PAGE_QUERY = { page: 2, limit: 50 };

/** Provides `queryClient` to the hook under test (a `.ts` file, so no JSX). */
function queryClientWrapper(queryClient: QueryClient): (props: { readonly children: React.ReactNode }) => React.JSX.Element {
	return function QueryClientWrapper({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
		return React.createElement(QueryClientProvider, { client: queryClient }, children);
	};
}

function isInvalidated(queryClient: QueryClient, queryKey: QueryKey): boolean | undefined {
	return queryClient.getQueryState(queryKey)?.isInvalidated;
}

beforeEach((): void => {
	vi.stubGlobal("EventSource", FakeEventSource);
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
	FakeEventSource.latest = null;
	FakeEventSource.opened = 0;
});

describe("useAuditTrailLive", () => {
	it("subscribes to the audit trail's stream", () => {
		renderHook(() => useAuditTrailLive(), { wrapper: queryClientWrapper(new QueryClient()) });

		expect(FakeEventSource.latest?.url).toBe(auditTrailEventsUrl());
		expect(new URL(auditTrailEventsUrl()).pathname).toMatch(/\/admin\/audit-trail\/events$/u);
	});

	it("declares the admin client type, so the API reads the admin's session cookie (EventSource cannot send X-Client-Type)", () => {
		expect(new URL(auditTrailEventsUrl()).searchParams.get("client_type")).toBe("admin");
	});

	it("reports the connection opening, for the Live pill", () => {
		const { result } = renderHook(() => useAuditTrailLive(), { wrapper: queryClientWrapper(new QueryClient()) });
		expect(result.current).toBe("connecting");

		act((): void => {
			const source = FakeEventSource.latest;
			if (source !== null) {
				source.readyState = READY_OPEN;
				source.dispatchEvent(new Event("open"));
			}
		});

		expect(result.current).toBe("open");
	});

	it("refetches every cached audit-log page on a signal, and nothing else", () => {
		const queryClient = new QueryClient();
		queryClient.setQueryData(apiRouter.auditTrail.list.queryKey(FIRST_PAGE_QUERY), null);
		queryClient.setQueryData(apiRouter.auditTrail.list.queryKey(SECOND_PAGE_QUERY), null);
		queryClient.setQueryData(apiRouter.email.logList.queryKey(FIRST_PAGE_QUERY), null);
		renderHook(() => useAuditTrailLive(), { wrapper: queryClientWrapper(queryClient) });

		act((): void => {
			FakeEventSource.latest?.dispatchEvent(new MessageEvent("message", { data: "changed" }));
		});

		expect(isInvalidated(queryClient, apiRouter.auditTrail.list.queryKey(FIRST_PAGE_QUERY))).toBe(true);
		expect(isInvalidated(queryClient, apiRouter.auditTrail.list.queryKey(SECOND_PAGE_QUERY))).toBe(true);
		expect(isInvalidated(queryClient, apiRouter.email.logList.queryKey(FIRST_PAGE_QUERY))).toBe(false);
	});

	it("keeps one connection across re-renders", () => {
		const { rerender } = renderHook(() => useAuditTrailLive(), { wrapper: queryClientWrapper(new QueryClient()) });

		rerender();
		rerender();

		expect(FakeEventSource.opened).toBe(1);
	});
});
