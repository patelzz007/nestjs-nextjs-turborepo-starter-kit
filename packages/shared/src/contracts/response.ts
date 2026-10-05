// ============================================
// contracts/response.ts - the RESPONSE half of a route contract
// ============================================
// Every `apiContract` leaf declares what the endpoint answers with, next to
// its method / path / input (ADR 022, docs/technical/api/response-contracts.md):
//
//   response: singleResponse(ProductSchema)          // { success, data: Product, meta }
//   response: paginatedResponse(ProductSchema)       // { success, data: Product[], meta: paginated }
//
// - The typed client parses every response with `response.envelope` (one place:
//   `parseResponseContract` in @workspace/client).
// - The API decorates the handler with the SAME `response.schema`
//   (`@ZodResponse(ProductSchema)` / `@ZodPaginatedResponse(ProductSchema)`),
//   which documents it in Swagger and enforces it at runtime; the OpenAPI e2e
//   test fails when a contract leaf and its handler disagree.

import type { ZodType } from "zod";

import { createApiPaginatedEnvelopeSchema, createApiSuccessEnvelopeSchema, type Envelope } from "../schemas/api/api-response";
import type { DataValue } from "../schemas/api/common";

/** Which success envelope an endpoint answers with. */
export type ApiResponseKind = "single" | "paginated";

/** The response half of one route contract. */
export interface ApiResponseContract<Data extends DataValue> {
	readonly kind: ApiResponseKind;
	/**
	 * The DATA schema (`single`) or the ITEM schema (`paginated`) — the exact
	 * reference the API handler's response decorator uses.
	 */
	readonly schema: ZodType;
	/** The full wire envelope a client parses the response body with. */
	readonly envelope: ZodType<Envelope<Data>>;
}

/** `{ success: true, data: <schema>, meta }` — every non-list endpoint. */
export function singleResponse<Data extends DataValue>(schema: ZodType<Data>): ApiResponseContract<Data> {
	return { kind: "single", schema, envelope: createApiSuccessEnvelopeSchema(schema) };
}

/** `{ success: true, data: <item>[], meta: { …pagination } }` — every list-grammar endpoint (docs/technical/api/list-queries.md). */
export function paginatedResponse<Item extends DataValue>(itemSchema: ZodType<Item>): ApiResponseContract<Item[]> {
	return { kind: "paginated", schema: itemSchema, envelope: createApiPaginatedEnvelopeSchema(itemSchema) };
}

/**
 * The response of a FILE download endpoint (an export): the body is the file
 * itself in one of `contentTypes` — never the JSON envelope — with
 * `Content-Disposition: attachment`. Errors still use the JSON error envelope.
 * The API documents each media type as a binary body (`@ZodFileResponse`); the
 * client reads it as a `Blob` (`fetchDownload` in @workspace/client), not
 * through `parseResponseContract`.
 */
export interface ApiFileResponseContract {
	readonly kind: "file";
	/** Every media type the endpoint may answer with (the request picks one, e.g. by `format`). */
	readonly contentTypes: readonly string[];
}

/** `fileResponse(["text/csv; charset=utf-8", "application/pdf"])` — a download endpoint's response half. */
export function fileResponse(contentTypes: readonly string[]): ApiFileResponseContract {
	return { kind: "file", contentTypes: [...contentTypes] };
}
