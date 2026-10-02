import { paginatedResponse, singleResponse } from "@workspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { jsonResponse, type FetchImpl } from "../test-utils";
import { createApiRequestContext, fetchMutation, fetchQuery } from "./api-request";
import { defineMutation, defineQuery } from "./endpoints";
import { ApiResponseContractError, MAX_RESPONSE_CONTRACT_ISSUES, parseResponseContract } from "./response-contract";

const BASE_URL = "http://api.test";
const SOURCE = { method: "GET", url: `${BASE_URL}/api/v1/items/1`, status: 200 };
const META = { correlationId: "corr-7", timestamp: 1_790_812_800_000 };

const ItemSchema = z.object({ id: z.string(), price: z.number() });
const itemResponse = singleResponse(ItemSchema);

const itemDef = defineQuery({ method: "GET", path: "/items/:id", input: z.object({ id: z.string() }), response: itemResponse }, { queryKey: ({ id }) => ["items", id] });
const itemListDef = defineQuery({ method: "GET", path: "/items", input: z.undefined(), response: paginatedResponse(ItemSchema) }, { queryKey: () => ["items"] });
const createDef = defineMutation({ method: "POST", path: "/items", input: z.object({ price: z.number() }), response: itemResponse }, { queryKey: () => ["items", "create"] });

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("parseResponseContract", () => {
	it("returns the parsed envelope and strips fields the contract does not declare (additive API fields never break a client)", () => {
		const parsed = parseResponseContract(itemResponse.envelope, { success: true, data: { id: "a", price: 3, addedLater: "new" }, meta: { ...META, region: "eu" } }, SOURCE);

		expect(parsed).toEqual({ success: true, data: { id: "a", price: 3 }, meta: META });
	});

	it("throws a typed ApiResponseContractError naming the request and the failing paths — never the body values", () => {
		const parse = (): void => {
			parseResponseContract(itemResponse.envelope, { success: true, data: { id: "a", price: "secret-value" }, meta: META }, SOURCE);
		};

		expect(parse).toThrow(ApiResponseContractError);
		try {
			parse();
		} catch (error) {
			expect(error).toBeInstanceOf(ApiResponseContractError);
			if (error instanceof ApiResponseContractError) {
				expect(error.method).toBe("GET");
				expect(error.url).toBe(SOURCE.url);
				expect(error.status).toBe(SOURCE.status);
				expect(error.issues.map((issue) => issue.path)).toEqual(["data.price"]);
				expect(error.message).toContain("data.price");
				expect(error.message).not.toContain("secret-value");
			}
		}
	});

	it("reports a root-level mismatch as `root`", () => {
		expect(() => parseResponseContract(itemResponse.envelope, "not an envelope", SOURCE)).toThrow(/root:/);
	});

	it("keeps at most MAX_RESPONSE_CONTRACT_ISSUES issues", () => {
		const ManySchema = singleResponse(z.array(z.number()));
		const body = { success: true, data: Array.from({ length: MAX_RESPONSE_CONTRACT_ISSUES * 2 }, (_, index: number): string => `x${String(index)}`), meta: META };

		try {
			parseResponseContract(ManySchema.envelope, body, SOURCE);
			expect.unreachable("the body violates the contract");
		} catch (error) {
			expect(error instanceof ApiResponseContractError ? error.issues.length : 0).toBe(MAX_RESPONSE_CONTRACT_ISSUES);
		}
	});
});

describe("the fetch layer validates every response with its contract", () => {
	const context = createApiRequestContext(BASE_URL);

	it("returns the parsed single envelope on a matching body", async () => {
		vi.stubGlobal("fetch", vi.fn<FetchImpl>().mockResolvedValue(jsonResponse(200, { success: true, data: { id: "a", price: 3 }, meta: META })));

		const result = await fetchQuery(context, itemDef, { id: "a" });

		expect(result).toEqual({ ok: true, status: 200, data: { success: true, data: { id: "a", price: 3 }, meta: META } });
	});

	it("parses the paginated envelope, including the pagination meta", async () => {
		const meta = { ...META, limit: 20, total: 1, page: 1, totalPages: 1, nextCursor: null, hasNext: false, hasPrevious: false };
		vi.stubGlobal("fetch", vi.fn<FetchImpl>().mockResolvedValue(jsonResponse(200, { success: true, data: [{ id: "a", price: 3 }], meta })));

		const result = await fetchQuery(context, itemListDef, undefined);

		expect(result.ok && result.data.meta).toEqual(meta);
	});

	it("turns a contract mismatch into a typed failure carrying the real HTTP status", async () => {
		vi.stubGlobal("fetch", vi.fn<FetchImpl>().mockResolvedValue(jsonResponse(201, { success: true, data: { id: "a" }, meta: META })));

		const result = await fetchMutation(context, createDef, { price: 3 });

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.status).toBe(201);
			expect(result.error).toBeInstanceOf(ApiResponseContractError);
			expect(result.error instanceof ApiResponseContractError ? result.error.issues : []).toEqual([{ path: "data.price", message: expect.any(String) }]);
		}
	});

	it("rejects a paginated body that lacks the pagination meta", async () => {
		vi.stubGlobal("fetch", vi.fn<FetchImpl>().mockResolvedValue(jsonResponse(200, { success: true, data: [], meta: META })));

		const result = await fetchQuery(context, itemListDef, undefined);

		expect(!result.ok && result.error instanceof ApiResponseContractError).toBe(true);
	});
});
