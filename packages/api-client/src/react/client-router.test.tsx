// @vitest-environment jsdom
// The ./react entry over BOTH transports: the same procedure hooks bind a
// cookie context (web) and a token context (mobile).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { DataValueSchema, singleResponse } from "@workspace/shared";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { createApiClientContext } from "../config";
import { AUTHORIZATION_HEADER } from "../http";
import { createApiRequestContext } from "../request";
import { defineMutation, defineQuery } from "../router";
import { firstFetchCall, headersOf, jsonResponse, MemoryTokenProvider, type FetchImpl } from "../testing";
import { buildClientRouter, createQueryProcedure } from "./hooks";

const META = { correlationId: "corr-1", timestamp: 1_790_812_800_000 };
const router = {
	auth: {
		me: defineQuery({ method: "GET", path: "/auth/me", input: z.undefined(), response: singleResponse(DataValueSchema) }, { scope: () => ["auth", "me"] }),
		rename: defineMutation({ method: "PATCH", path: "/auth/profile", input: z.object({ name: z.string() }), response: singleResponse(DataValueSchema) }),
	},
};

function wrapperFor(queryClient: QueryClient): (props: { readonly children: React.ReactNode }) => React.JSX.Element {
	return function Wrapper({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
		return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
	};
}

function stubOkFetch(): ReturnType<typeof vi.fn<FetchImpl>> {
	const fetchMock = vi.fn<FetchImpl>(() => Promise.resolve(jsonResponse(200, { success: true, data: { id: "u1" }, meta: META })));
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

afterEach((): void => {
	vi.unstubAllGlobals();
});

describe("buildClientRouter", () => {
	it("binds every query leaf to useQuery under its router key", async () => {
		stubOkFetch();
		const client = buildClientRouter(router, createApiRequestContext("http://api.test", "web"));
		const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

		const { result } = renderHook(() => client.auth.me.useQuery(undefined), { wrapper: wrapperFor(queryClient) });

		await waitFor(() => {
			expect(result.current.isSuccess).toBe(true);
		});
		expect(queryClient.getQueryData(router.auth.me.queryKey(undefined))).toEqual({ success: true, data: { id: "u1" }, meta: META });
	});

	it("binds every mutation leaf to useMutation", async () => {
		const fetchMock = stubOkFetch();
		const client = buildClientRouter(router, createApiRequestContext("http://api.test", "web"));

		const { result } = renderHook(() => client.auth.rename.useMutation(), { wrapper: wrapperFor(new QueryClient()) });
		await act(async () => {
			await result.current.mutateAsync({ name: "Sam" });
		});

		expect(firstFetchCall(fetchMock).init.body).toBe(JSON.stringify({ name: "Sam" }));
	});

	it("sends the mobile Bearer token through the same hooks on a token context", async () => {
		const fetchMock = stubOkFetch();
		const context = createApiClientContext({
			baseUrl: "http://api.test",
			clientType: "mobile",
			transport: { kind: "token", tokenProvider: new MemoryTokenProvider({ accessToken: "access-1", refreshToken: "refresh-1" }) },
			appVersion: "1.4.0",
		});
		const me = createQueryProcedure(context, router.auth.me);
		const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

		const { result } = renderHook(() => me.useQuery(undefined), { wrapper: wrapperFor(queryClient) });

		await waitFor(() => {
			expect(result.current.isSuccess).toBe(true);
		});
		expect(headersOf(firstFetchCall(fetchMock).init)[AUTHORIZATION_HEADER]).toBe("Bearer access-1");
	});
});
