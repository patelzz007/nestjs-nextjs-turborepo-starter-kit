// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { EmailPreviewListResponse } from "@workspace/shared";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { jsonResponse, type FetchImpl } from "../test-utils";
import type { ApiRequestContext } from "./api-request";
import { createQueryProcedure } from "./client-router";
import { apiRouter } from "./endpoints";

const CONTEXT: ApiRequestContext = { baseUrl: "http://api.test", clientType: "admin" };
const META = { correlationId: "corr-1", timestamp: 1_790_812_800_000 };
const LIST: EmailPreviewListResponse = {
	templates: [{ key: "welcome", label: "Welcome", description: "Sent after verification", sampleTo: "sam@example.com", sampleSubject: "Welcome aboard" }],
};

/** A GET procedure over the real fetcher and response contract; only `fetch` is stubbed. */
const previewList = createQueryProcedure(CONTEXT, apiRouter.email.previewList);

function stubFetch(): ReturnType<typeof vi.fn<FetchImpl>> {
	const fetchMock = vi.fn<FetchImpl>(() => Promise.resolve(jsonResponse(200, { success: true, data: LIST, meta: META })));
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

function wrapperFor(queryClient: QueryClient): (props: { readonly children: React.ReactNode }) => React.JSX.Element {
	return function Wrapper({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
		return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
	};
}

afterEach((): void => {
	vi.unstubAllGlobals();
});

describe("ClientQueryProcedure.usePrefetch", () => {
	it("warms the cache, so the matching useQuery renders its data at once without fetching again", async () => {
		const fetchMock = stubFetch();
		const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		const wrapper = wrapperFor(queryClient);

		const { result: prefetch } = renderHook(() => previewList.usePrefetch(), { wrapper });
		act((): void => {
			prefetch.current(undefined);
		});
		await waitFor((): void => {
			expect(queryClient.getQueryData(apiRouter.email.previewList.queryKey(undefined))).toEqual({ success: true, data: LIST, meta: META });
		});

		const { result: query } = renderHook(() => previewList.useQuery(undefined, { staleTime: Number.POSITIVE_INFINITY }), { wrapper });

		expect(query.current.data?.data).toEqual(LIST);
		expect(query.current.isPending).toBe(false);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("does not fetch again while the cached entry is fresher than staleTime", async () => {
		const fetchMock = stubFetch();
		const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		const { result: prefetch } = renderHook(() => previewList.usePrefetch({ staleTime: Number.POSITIVE_INFINITY }), { wrapper: wrapperFor(queryClient) });

		act((): void => {
			prefetch.current(undefined);
		});
		await waitFor((): void => {
			expect(fetchMock).toHaveBeenCalledTimes(1);
		});
		act((): void => {
			prefetch.current(undefined);
			prefetch.current(undefined);
		});

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("keeps the same callback across renders, so it is safe in effect and handler dependencies", () => {
		stubFetch();
		const { result, rerender } = renderHook(() => previewList.usePrefetch(), { wrapper: wrapperFor(new QueryClient()) });
		const first = result.current;

		rerender();

		expect(result.current).toBe(first);
	});

	it("swallows a failed warm-up: the page's own useQuery fetches and reports instead", async () => {
		const fetchMock = vi.fn<FetchImpl>(() => Promise.reject(new TypeError("offline")));
		vi.stubGlobal("fetch", fetchMock);
		const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		const { result } = renderHook(() => previewList.usePrefetch(), { wrapper: wrapperFor(queryClient) });

		act((): void => {
			result.current(undefined);
		});

		await waitFor((): void => {
			expect(fetchMock).toHaveBeenCalledTimes(1);
		});
		expect(queryClient.getQueryData(apiRouter.email.previewList.queryKey(undefined))).toBeUndefined();
	});
});
