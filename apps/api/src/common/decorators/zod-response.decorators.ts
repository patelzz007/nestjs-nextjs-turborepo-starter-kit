// ============================================
// common/decorators/zod-response.decorators.ts - document + ENFORCE a response from ONE zod schema
// ============================================
// The response half of the request decorators (`zod-request.decorators.ts`),
// ADR 022 / docs/technical/api/response-contracts.md. One decorator per handler:
//
//   @ZodResponse(ProductSchema)                                  // 200, { success, data: Product, meta }
//   @ZodResponse(ProductSchema, { status: HttpStatus.CREATED })  // 201
//   @ZodPaginatedResponse(ProductSchema)                         // { success, data: Product[], meta: paginated }
//   @ZodRawResponse(ApiVersionManifestSchema)                    // no envelope (the unversioned version manifest)
//   @ZodFileResponse(contract.response)                          // a FILE download (an export), body written via @Res()
//
// Each one, from the SAME shared schema (`@workspace/shared`):
//   1. documents the success response in Swagger — the full envelope, converted
//      by `zodStandardSchemaConverter` (io: "output") like the request side —
//      plus the ADR 016 error envelope for every `4XX` / `5XX`;
//   2. sets the HTTP status (`HttpCode`), so documented and sent status agree;
//   3. registers the contract (Nest metadata, `ResponseContract`) the global `ResponseInterceptor` ENFORCES: the
//      handler result is parsed with the schema (single pass) — unknown keys
//      are stripped, so an internal field can never reach the wire, and a
//      mismatch is a server bug answered with a logged 500;
//   4. type-checks the handler at COMPILE time: its return type must be
//      assignable to the schema's input (a Prisma row with a `bigint` / `Date`
//      field does not compile — map it to the contract DTO first).
//
// `test/openapi-document.e2e-spec.ts` fails for any route without a contract
// and for any `apiContract` leaf whose handler uses a different schema.

import { applyDecorators, HttpCode, HttpStatus } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ApiResponse } from "@nestjs/swagger";
import {
	createApiPaginatedEnvelopeSchema,
	createApiSuccessEnvelopeSchema,
	createPaginatedServiceResultSchema,
	type DataValue,
	type PaginatedServiceResult,
} from "@workspace/shared";
import type { z } from "zod";

import { ApiErrorResponseDto } from "../dto/api-response.dto";

/** How the response interceptor wraps (or does not wrap) a handler result. */
export type ResponseEnvelopeKind = "single" | "paginated" | "raw";

/** The response contract of ONE route handler, as enforced by `ResponseInterceptor`. */
export type RouteResponseContract =
	| {
			/** `single`: wrapped as `data`; `raw`: sent as the body itself. */
			readonly kind: "single" | "raw";
			/** The schema the decorator was given — the handler result is parsed with it. */
			readonly schema: z.ZodType<DataValue>;
			/** The HTTP status sent and documented for a success. */
			readonly status: HttpStatus;
	  }
	| {
			readonly kind: "paginated";
			/** The list ITEM schema the decorator was given. */
			readonly schema: z.ZodType<DataValue>;
			/** The service page the handler result is parsed with: `items` (each by the item schema) + pagination fields. */
			readonly page: z.ZodType<PaginatedServiceResult>;
			readonly status: HttpStatus;
	  };

/** Options shared by the response decorators. */
export interface ZodResponseOptions {
	/** Success status (default `200 OK`). POST handlers that create a resource pass `HttpStatus.CREATED`. */
	readonly status?: HttpStatus | undefined;
	/** Swagger description of the success response. */
	readonly description?: string | undefined;
}

/** A handler may answer synchronously or with a promise. */
type Awaitable<T> = T | Promise<T>;

/**
 * What a handler may return for a schema whose input type is `T`: the same
 * shape, read-only all the way down — parsing never mutates the result, so a
 * service may hand back `readonly` arrays / objects it shares with a cache.
 */
export type ResponseInput<T> = T extends readonly (infer TElement)[]
	? readonly ResponseInput<TElement>[]
	: T extends object
		? { readonly [TKey in keyof T]: ResponseInput<T[TKey]> }
		: T;

/**
 * A method decorator that only accepts handlers whose return type is
 * assignable to `T` — the compile-time half of the contract.
 */
export type TypedResponseDecorator<T> = <TTarget extends object, THandler extends (...args: Parameters<THandler>) => Awaitable<ResponseInput<T>>>(
	target: TTarget,
	propertyKey: string | symbol,
	descriptor: TypedPropertyDescriptor<THandler>,
) => void;

/**
 * Handler → contract, stored as Nest (reflect-)metadata on the handler — the
 * same mechanism as every other route decorator (`@SkipEnvelope`, `@Sse`, …).
 *
 * Never key it by function identity (a WeakMap): `ExecutionContext.getHandler()`
 * does not always return the decorated function. Instrumentation such as
 * `@nestjs/observe` (on by default in production, `OBSERVE_ENABLED`) hands Nest
 * a traced wrapper per method and copies only the reflect-metadata across, so
 * an identity-keyed lookup misses on every route and each request fails with
 * `MissingResponseContractError`.
 */
export const ResponseContract = Reflector.createDecorator<RouteResponseContract>();

/** Reads metadata only — `Reflector` holds no state, so one module-level instance serves every caller. */
const contractReflector = new Reflector();

/** What Nest metadata is read from — a route handler (or class). */
export type ResponseContractTarget = Parameters<Reflector["get"]>[1];

/** The response contract registered for a route handler, or `undefined` when it has none. */
// `Reflector.get` is typed as always returning the value; an undecorated handler has none, so
// this signature states the real `| undefined` for callers to handle.
export function getResponseContract(handler: ResponseContractTarget): RouteResponseContract | undefined {
	return contractReflector.get(ResponseContract, handler);
}

const DEFAULT_SUCCESS_DESCRIPTION = "Success";
const CLIENT_ERROR_DESCRIPTION = "Client error — the standard error envelope (docs/technical/api/errors.md); branch on `error.code`.";
const SERVER_ERROR_DESCRIPTION = "Server error — the standard error envelope with a generic message; quote `meta.correlationId`.";

function responseDecorator<T>(contract: RouteResponseContract, documented: z.ZodType, description: string | undefined): TypedResponseDecorator<T> {
	return (target, propertyKey, descriptor): void => {
		const handler: WeakKey | undefined = descriptor.value;
		if (handler === undefined) {
			throw new Error(`Response decorators apply to methods only (${String(propertyKey)}).`);
		}
		applyDecorators(
			ResponseContract(contract),
			HttpCode(contract.status),
			ApiResponse({ status: contract.status, description: description ?? DEFAULT_SUCCESS_DESCRIPTION, standardSchema: documented }),
			ApiResponse({ status: "4XX", description: CLIENT_ERROR_DESCRIPTION, type: ApiErrorResponseDto }),
			ApiResponse({ status: "5XX", description: SERVER_ERROR_DESCRIPTION, type: ApiErrorResponseDto }),
		)(target, propertyKey, descriptor);
	};
}

/**
 * The handler returns `data`; the client receives `{ success: true, data, meta }`.
 * The returned value is parsed with `schema` (strip unknown keys, 500 on mismatch).
 */
export function ZodResponse<TSchema extends z.ZodType<DataValue>>(schema: TSchema, options: ZodResponseOptions = {}): TypedResponseDecorator<z.input<TSchema>> {
	return responseDecorator<z.input<TSchema>>({ kind: "single", schema, status: options.status ?? HttpStatus.OK }, createApiSuccessEnvelopeSchema(schema), options.description);
}

/**
 * The handler returns one page (`PaginatedServiceResult` — `items` plus the
 * pagination fields); the client receives `{ success: true, data: items, meta: { …pagination } }`.
 * Every item is parsed with `itemSchema`. For list-grammar endpoints (docs/technical/api/list-queries.md).
 */
export function ZodPaginatedResponse<TItemSchema extends z.ZodType<DataValue>>(
	itemSchema: TItemSchema,
	options: ZodResponseOptions = {},
): TypedResponseDecorator<PaginatedServiceResult<z.input<TItemSchema>>> {
	const item: z.ZodType<DataValue> = itemSchema;
	return responseDecorator<PaginatedServiceResult<z.input<TItemSchema>>>(
		{ kind: "paginated", schema: item, page: createPaginatedServiceResultSchema(item), status: options.status ?? HttpStatus.OK },
		createApiPaginatedEnvelopeSchema(itemSchema),
		options.description,
	);
}

/**
 * The handler result IS the body — no `{ success, data, meta }` envelope.
 * Only for endpoints whose consumer is not the typed client and expects a
 * fixed raw shape (today only the unversioned `GET /version` manifest).
 * Still parsed with `schema`: stripped and enforced like every other route.
 */
export function ZodRawResponse<TSchema extends z.ZodType<DataValue>>(schema: TSchema, options: ZodResponseOptions = {}): TypedResponseDecorator<z.input<TSchema>> {
	return responseDecorator<z.input<TSchema>>({ kind: "raw", schema, status: options.status ?? HttpStatus.OK }, schema, options.description);
}

/**
 * The response contract of a FILE download route (an export): the body is the
 * file itself in one of `contentTypes`, written by the handler through
 * `@Res()` — `ResponseInterceptor` passes it through untouched. Errors still
 * answer the JSON error envelope (the global exception filter).
 */
export interface FileResponseContract {
	readonly contentTypes: readonly string[];
	readonly status: HttpStatus;
}

/** Handler → file contract, as Nest metadata (see {@link ResponseContract} for why not a WeakMap). */
export const FileResponseContractMetadata = Reflector.createDecorator<FileResponseContract>();

/** The file contract registered for a route handler, or `undefined` for every JSON route. */
export function getFileResponseContract(handler: ResponseContractTarget): FileResponseContract | undefined {
	return contractReflector.get(FileResponseContractMetadata, handler);
}

/** A handler that writes the file itself (through `@Res()`) and resolves once it has handed the stream over. */
export type FileResponseDecorator = <THandler extends (...args: Parameters<THandler>) => Promise<void>>(
	target: object,
	propertyKey: string | symbol,
	descriptor: TypedPropertyDescriptor<THandler>,
) => void;

/** The binary body documented for every media type of a file route. */
const BINARY_BODY_SCHEMA = { type: "string", format: "binary" };

/** Default description of a file route's 200. */
const FILE_RESPONSE_DESCRIPTION = "The file (Content-Disposition: attachment)";

/**
 * Declares (and documents) a FILE download route from the shared contract
 * leaf's `fileResponse(...)`: registers the file contract (so
 * `ResponseInterceptor` passes the reply through), sets the 200 status,
 * documents the 200 as one binary body per media type and the 4XX / 5XX JSON
 * error envelope. The handler writes the reply itself (`@Res()`), sets
 * `Content-Type` to one of `contentTypes` and `Content-Disposition: attachment`.
 */
export function ZodFileResponse(contract: { readonly contentTypes: readonly string[] }, options: Pick<ZodResponseOptions, "description"> = {}): FileResponseDecorator {
	return (target, propertyKey, descriptor): void => {
		const fileContract: FileResponseContract = { contentTypes: [...contract.contentTypes], status: HttpStatus.OK };
		applyDecorators(
			FileResponseContractMetadata(fileContract),
			HttpCode(fileContract.status),
			ApiResponse({
				status: fileContract.status,
				description: options.description ?? FILE_RESPONSE_DESCRIPTION,
				content: Object.fromEntries(fileContract.contentTypes.map((contentType) => [contentType, { schema: BINARY_BODY_SCHEMA }])),
			}),
			ApiResponse({ status: "4XX", description: CLIENT_ERROR_DESCRIPTION, type: ApiErrorResponseDto }),
			ApiResponse({ status: "5XX", description: SERVER_ERROR_DESCRIPTION, type: ApiErrorResponseDto }),
		)(target, propertyKey, descriptor);
	};
}
