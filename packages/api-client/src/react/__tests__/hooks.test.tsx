// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { IDEMPOTENCY_KEY_HEADER, type EmailPreviewListResponse } from "@workspace/shared";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiRequestContext } from "../../request";
import { apiRouter } from "../../router";
import { jsonResponse, type FetchImpl } from "../../testing";
import { createMutationProcedure, createQueryProcedure } from "../hooks";

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

describe("ClientMutationProcedure.useIdempotentMutation", () => {
	const PULL_REQUEST = { owner: "octo-org", repository: "hello-world", number: 42 };
	const COMMENT = {
		id: "IC_new",
		author: { login: "octocat", avatarUrl: null },
		body: "Thanks!",
		images: [],
		reactions: [],
		reactionSubject: { type: "issueComment", commentId: "6186769145" },
		createdAt: META.timestamp,
		lastEditedAt: null,
		viewerCanUpdate: true,
		viewerDidAuthor: true,
		htmlUrl: "https://github.com/octo-org/hello-world/pull/42#issuecomment-1",
	};
	const addComment = createMutationProcedure(CONTEXT, apiRouter.githubPullRequests.addComment);

	function headerOf(call: Parameters<FetchImpl>, name: string): string | null {
		const [, init] = call;
		return new Headers(init?.headers).get(name);
	}

	it("sends the call's key as the Idempotency-Key header, and the same key again on a retry", async () => {
		const fetchMock = vi.fn<FetchImpl>(() => Promise.resolve(jsonResponse(201, { success: true, data: COMMENT, meta: META })));
		vi.stubGlobal("fetch", fetchMock);
		const { result } = renderHook(() => addComment.useIdempotentMutation(), { wrapper: wrapperFor(new QueryClient()) });

		await act(async (): Promise<void> => {
			await result.current.mutateAsync({ input: { ...PULL_REQUEST, body: "Thanks!" }, idempotencyKey: "draft-key-0001" });
			await result.current.mutateAsync({ input: { ...PULL_REQUEST, body: "Thanks!" }, idempotencyKey: "draft-key-0001" });
		});

		expect(fetchMock.mock.calls.map((call) => headerOf(call, IDEMPOTENCY_KEY_HEADER))).toEqual(["draft-key-0001", "draft-key-0001"]);
		await waitFor((): void => {
			expect(result.current.data?.data).toEqual(COMMENT);
		});
	});

	it("sends no key from a plain useMutation", async () => {
		const fetchMock = vi.fn<FetchImpl>(() => Promise.resolve(jsonResponse(201, { success: true, data: COMMENT, meta: META })));
		vi.stubGlobal("fetch", fetchMock);
		const { result } = renderHook(() => addComment.useMutation(), { wrapper: wrapperFor(new QueryClient()) });

		await act(async (): Promise<void> => {
			await result.current.mutateAsync({ ...PULL_REQUEST, body: "Thanks!" });
		});

		expect(fetchMock.mock.calls.map((call) => headerOf(call, IDEMPOTENCY_KEY_HEADER))).toEqual([null]);
	});
});
