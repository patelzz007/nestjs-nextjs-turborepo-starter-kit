// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import { CLIENT_TYPE_QUERY_PARAM } from "@workspace/shared";
import type { JSX, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiRouter } from "../../../api/endpoints";
import { NOTIFICATIONS_POLL_INTERVAL_MS, notificationsPollInterval, useNotificationsLive } from "../use-notifications-live";

const { authCommands } = vi.hoisted(() => ({ authCommands: { refreshSession: (): Promise<"ok"> => Promise.resolve("ok") } }));
vi.mock("../../../contexts/identity", () => ({ useAuthCommands: (): typeof authCommands => authCommands, useAuthClientType: (): "merchant" => "merchant" }));

const READY_CONNECTING = 0;
const READY_OPEN = 1;

/** A controllable stand-in for the browser's EventSource (jsdom has none). */
class FakeEventSource extends EventTarget {
	public static latest: FakeEventSource | null = null;
	public readyState: number = READY_CONNECTING;
	public readonly url: string;

	public constructor(url: string) {
		super();
		this.url = url;
		FakeEventSource.latest = this;
	}

	public close(): void {
		this.readyState = READY_CONNECTING;
	}
}

let queryClient: QueryClient;

function Providers({ children }: { readonly children: ReactNode }): JSX.Element {
	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
	queryClient = new QueryClient();
	vi.stubGlobal("EventSource", FakeEventSource);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	FakeEventSource.latest = null;
});

function latestSource(): FakeEventSource {
	const source = FakeEventSource.latest;
	if (source === null) {
		throw new Error("No EventSource was opened");
	}
	return source;
}

describe("useNotificationsLive", () => {
	it("opens the surface's stream as this app and refetches the inbox and unread count on every frame", () => {
		const invalidate = vi.spyOn(queryClient, "invalidateQueries");
		const { result } = renderHook(() => useNotificationsLive("MERCHANT"), { wrapper: Providers });

		const url = new URL(latestSource().url);
		expect(url.pathname).toMatch(/\/notifications\/stream$/u);
		expect(url.searchParams.get("surface")).toBe("MERCHANT");
		expect(url.searchParams.get(CLIENT_TYPE_QUERY_PARAM)).toBe("merchant");
		expect(result.current).toBe("connecting");

		act(() => {
			latestSource().readyState = READY_OPEN;
			latestSource().dispatchEvent(new Event("open"));
		});
		expect(result.current).toBe("open");

		act(() => {
			latestSource().dispatchEvent(new Event("message"));
		});
		expect(invalidate).toHaveBeenCalledWith({ queryKey: apiRouter.notifications.inbox.scopeKey(undefined) });
		// The unread count's key sits under the inbox scope, so the same invalidation reaches it.
		expect(apiRouter.notifications.unreadCount.queryKey({ surface: "MERCHANT" }).slice(0, apiRouter.notifications.inbox.scopeKey(undefined).length)).toEqual(
			apiRouter.notifications.inbox.scopeKey(undefined),
		);
	});
});

describe("notificationsPollInterval", () => {
	it("does not poll while live, and polls every minute otherwise", () => {
		expect(notificationsPollInterval("open")).toBe(false);
		expect(notificationsPollInterval("connecting")).toBe(NOTIFICATIONS_POLL_INTERVAL_MS);
		expect(notificationsPollInterval("closed")).toBe(NOTIFICATIONS_POLL_INTERVAL_MS);
	});
});
