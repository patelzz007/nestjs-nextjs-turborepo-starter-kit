import { z } from "zod";

import { EpochMsSchema, DataValueSchema, type DataValue } from "./common";

// ── Shared response envelope primitives ──────────────────────────────────
// Every success response is ONE of two envelopes (ADR 022, docs/response-contracts.md):
//
//   single    → { success: true, data: <Data>,   meta: ApiResponseMeta }
//   paginated → { success: true, data: <Item>[], meta: ApiPaginatedMeta }
//
// built by `createApiSuccessEnvelopeSchema` / `createApiPaginatedEnvelopeSchema`.
// The API documents and enforces them (`@ZodResponse` / `@ZodPaginatedResponse`),
// the typed client parses every response with them. Envelope and meta objects
// STRIP unknown keys (no `.strict()`): a field the API adds later is ignored by
// an older client instead of failing its parse (rules/05 → "Contract change
// safety matrix": adding a response field must be safe).

/**
 * Metadata included in every API response by the ResponseInterceptor.
 */
export const ApiResponseMetaSchema = z.object({
	correlationId: z.string().default("").meta({
		description: "Request tracing ID (from X-Correlation-Id header or auto-generated)",
		example: "abc123-def456",
	}),
	timestamp: EpochMsSchema.meta({
		description: "Epoch milliseconds when the response was generated",
		example: 1786300000000,
	}),
});

export type ApiResponseMeta = z.output<typeof ApiResponseMetaSchema>;

/**
 * Paginated meta — extended metadata returned for cursor-paginated list endpoints.
 */
export const ApiPaginatedMetaSchema = ApiResponseMetaSchema.extend({
	limit: z.number().int().min(1).max(100).meta({ description: "Items per page", example: 20 }),
	total: z.number().int().nonnegative().meta({ description: "Total rows matching the current filters", example: 156 }),
	page: z.number().int().min(1).meta({ description: "Current page (1-indexed)", example: 1 }),
	totalPages: z.number().int().min(1).meta({ description: "Total pages for the current filters and page size", example: 8 }),
	nextCursor: z.string().nullable().meta({ description: "Opaque cursor for the next page, or null when there are no more rows", example: "Y2x1c18x" }),
	hasNext: z.boolean().meta({ description: "Whether a next page exists", example: true }),
	hasPrevious: z.boolean().meta({ description: "Whether a previous page exists", example: false }),
});

export type ApiPaginatedMeta = z.output<typeof ApiPaginatedMetaSchema>;

/**
 * The pagination fields a list service returns next to its `items` (the
 * `paginate()` / `fetchListPage` result) — the response interceptor moves them
 * into `meta` and the items into `data`.
 */
export const PaginatedServiceFieldsSchema = z.object({
	limit: z.number().int().min(1),
	total: z.number().int().nonnegative(),
	page: z.number().int().min(1),
	totalPages: z.number().int().min(1),
	nextCursor: z.string().nullable(),
	hasNext: z.boolean(),
	hasPrevious: z.boolean(),
});

/**
 * The service-side shape of ONE page of `itemSchema` items: what a list handler
 * returns BEFORE the response interceptor flattens `items` into `data` and the
 * pagination fields into `meta`. `@ZodPaginatedResponse` parses handler results
 * with it, so every item is validated (and stripped) by the item schema.
 */
export function createPaginatedServiceResultSchema<ItemSchema extends z.ZodType>(
	itemSchema: ItemSchema,
): z.ZodObject<typeof PaginatedServiceFieldsSchema.shape & { items: z.ZodArray<ItemSchema> }> {
	return PaginatedServiceFieldsSchema.extend({ items: z.array(itemSchema) });
}

/** Shape returned by the API list helpers, with JSON-safe items (see {@link createPaginatedServiceResultSchema}). */
export const PaginatedServiceResultSchema = createPaginatedServiceResultSchema(DataValueSchema);

export interface PaginatedServiceResult<TItem = DataValue> {
	items: TItem[];
	limit: number;
	total: number;
	page: number;
	totalPages: number;
	nextCursor: string | null;
	hasNext: boolean;
	hasPrevious: boolean;
}

/** Payload returned by soft-delete endpoints (`DELETE /:id`). */
export const DeleteSuccessDataSchema = z.object({
	success: z.literal(true),
});

export type DeleteSuccessData = z.output<typeof DeleteSuccessDataSchema>;

/** The `success` literal shared by both success envelopes. */
const SuccessFlagSchema = z.literal(true).meta({
	description: "Indicates the request was successful",
	example: true,
});

/**
 * Success response envelope with an untyped (any JSON value) `data` — for
 * tests and tools that inspect the envelope before knowing the endpoint.
 * Endpoint code uses the typed factories below.
 */
export const ApiSuccessResponseSchema = z.object({
	success: SuccessFlagSchema,
	data: DataValueSchema.meta({
		description: "The response payload — varies by endpoint",
	}),
	meta: ApiResponseMetaSchema,
});

export type ApiSuccessResponse = z.output<typeof ApiSuccessResponseSchema>;

/**
 * The SINGLE success envelope `{ success: true, data, meta }` around
 * `dataSchema` — used by the API (`@ZodResponse` documents it) and by the
 * typed client (`singleResponse` in the shared contract parses with it).
 */
export function createApiSuccessEnvelopeSchema<DataSchema extends z.ZodType>(
	dataSchema: DataSchema,
): z.ZodObject<{
	success: typeof SuccessFlagSchema;
	data: DataSchema;
	meta: typeof ApiResponseMetaSchema;
}> {
	return z.object({
		success: SuccessFlagSchema,
		data: dataSchema,
		meta: ApiResponseMetaSchema,
	});
}

/**
 * The PAGINATED success envelope `{ success: true, data: Item[], meta }` with
 * pagination fields in `meta` (docs/list-queries.md) — every list endpoint.
 */
export function createApiPaginatedEnvelopeSchema<ItemSchema extends z.ZodType>(
	itemSchema: ItemSchema,
): z.ZodObject<{
	success: typeof SuccessFlagSchema;
	data: z.ZodArray<ItemSchema>;
	meta: typeof ApiPaginatedMetaSchema;
}> {
	return z.object({
		success: SuccessFlagSchema,
		data: z.array(itemSchema),
		meta: ApiPaginatedMetaSchema,
	});
}

// The error envelope (`ApiErrorResponseSchema`) and the flattened client error
// body (`ApiErrorBodySchema`) live in `./api-error.ts`.

/**
 * The envelope is an interface WITH an index signature: the index signature is
 * what makes `Envelope<Data> extends DataValue` provable for the defs' `Resp`
 * constraint (interfaces only get index-signature assignability when they
 * declare one), while staying a plain interface per the lint rules.
 */
export interface Envelope<Data extends DataValue> {
	readonly success: true;
	readonly data: Data;
	readonly meta: ApiResponseMeta;
	readonly [key: string]: DataValue | undefined;
}
