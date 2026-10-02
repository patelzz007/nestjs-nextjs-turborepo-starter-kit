// ============================================
// common/decorators/zod-request.decorators.ts - validate + document request input from ONE zod schema
// ============================================
// `@Body(new ZodValidationPipe(Schema))` validates, but TypeScript types are
// erased at runtime, so Swagger reflected `Object` and published NO request
// body / parameters. These decorators do both jobs from the same schema
// (rules/05-contracts-zod-api.md — zod is the single source of truth):
//
//   1. validation — the existing `ZodValidationPipe`, exactly as before (same
//      compiled Ajv validator, same `{ message: "Validation failed", errors }`
//      error envelope);
//   2. documentation — the schema is attached to the parameter through Nest
//      12's native `@Body({ schema })` option. @nestjs/swagger 12 reads it and,
//      via `zodStandardSchemaConverter` (see `buildOpenApiDocument`), emits the
//      `requestBody`, or one `in: query` / `in: path` parameter per object key,
//      with required fields, types, enums, formats, bounds and
//      `.describe()` / `.meta({ description, example })`.
//
//   public create(@ZodBody(CreateProductSchema) body: z.output<typeof CreateProductSchema>) { … }
//   public list(@ZodListQuery(ProductListQuerySchema) query: ProductListQuery) { … }   // list endpoints
//   public export(@ZodQuery(GeoExportQuerySchema) query: z.output<typeof GeoExportQuerySchema>) { … }
//   public get(@ZodParams(ProductIdParamSchema) params: { id: string }) { … }
//   public detail(@ZodParam("id", UuidParamSchema) id: string) { … }
//
// Every `@Body` / `@Query` / `@Param` in a controller must use one of these —
// `test/openapi-document.e2e-spec.ts` fails for any route input that is not
// both validated and documented.

import { Body, Param, Query } from "@nestjs/common";
import type { z } from "zod";

import { BracketQueryPipe } from "../pipes/bracket-query.pipe";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

/** Validate the JSON request body with `schema` and document it as the operation's `requestBody`. */
export function ZodBody(schema: z.ZodType): ParameterDecorator {
	return Body({ schema, pipes: [new ZodValidationPipe(schema)] });
}

/** Validate the query string with an OBJECT `schema` and document each key as an `in: query` parameter. */
export function ZodQuery(schema: z.ZodType): ParameterDecorator {
	return Query({ schema, pipes: [new ZodValidationPipe(schema)] });
}

/**
 * Validate a LIST query (a `defineListQuery(...).schema`) and document each key.
 * Flat `filter[field][op]` keys are nested first, then the schema is parsed with
 * zod (not Ajv) so filters are normalized into the typed filter AST and unknown
 * sort / filter fields are rejected with messages listing the allowed ones.
 * The handler receives the PARSED query. See docs/list-queries.md.
 */
export function ZodListQuery(schema: z.ZodType): ParameterDecorator {
	return Query({ schema, pipes: [new BracketQueryPipe(), new ZodValidationPipe(schema, { engine: "zod" })] });
}

/** Validate ALL route params with an OBJECT `schema` and document each key as an `in: path` parameter. */
export function ZodParams(schema: z.ZodType): ParameterDecorator {
	return Param({ schema, pipes: [new ZodValidationPipe(schema)] });
}

/** Validate ONE named route param (`:name`) with a value `schema` and document it as an `in: path` parameter. */
export function ZodParam(name: string, schema: z.ZodType): ParameterDecorator {
	return Param(name, { schema, pipes: [new ZodValidationPipe(schema)] });
}
