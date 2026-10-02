// ============================================
// common/pipes/bracket-query.pipe.ts - flat `filter[field][op]` keys → nested filter object
// ============================================
// Fastify's query-string parser keeps bracket keys literal
// (`{ "filter[status][in]": "A,B" }`). The list-query schemas validate a nested
// `filter` object, so list endpoints run this pipe first. The conversion is the
// shared, prototype-pollution-safe `nestBracketQueryParams` (strict identifier
// pattern, capped key count, `Map` + `Object.fromEntries`), scoped to list
// queries — no global query-string parser change for every other route.

import { BadRequestException, Injectable, type PipeTransform } from "@nestjs/common";
import { JsonValueSchema, nestBracketQueryParams, type JsonValue, type NestBracketQueryResult } from "@workspace/shared";
import { z } from "zod";

/** Fastify query values: a string, or an array of strings for a repeated key. */
const RawQueryStringRecordSchema = z.record(z.string(), z.union([z.string(), z.array(z.string())]));

@Injectable()
export class BracketQueryPipe implements PipeTransform<JsonValue, JsonValue> {
	public transform(value: JsonValue): JsonValue {
		const raw = RawQueryStringRecordSchema.safeParse(value);
		if (!raw.success) {
			// Not a plain query-string record — leave it for the schema to reject.
			return value;
		}
		const nested: NestBracketQueryResult = nestBracketQueryParams(raw.data);
		if (!nested.success) {
			throw new BadRequestException({
				message: "Validation failed",
				errors: [{ path: "filter", message: nested.message, code: "invalid_filter" }],
				statusCode: 400,
			});
		}
		// Re-validated as JSON so the pipe chain keeps one value type (the next pipe is the zod list schema).
		return JsonValueSchema.parse(nested.query);
	}
}
