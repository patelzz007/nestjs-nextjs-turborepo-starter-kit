import { ApiErrorResponseSchema, JsonObjectSchema, type JsonObject } from "@workspace/shared";
import { createZodDto } from "nestjs-zod";
import { z } from "zod";

/**
 * The static method @nestjs/swagger reads a DTO class's properties from (its
 * `METADATA_FACTORY_NAME`, which the package does not export). nestjs-zod DTOs
 * implement it; `zod-response.decorators.spec.ts` proves Swagger calls ours.
 */
export const SWAGGER_METADATA_FACTORY = "_OPENAPI_METADATA_FACTORY";

/** nestjs-zod's DTO for the error envelope: it turns the zod schema into Swagger property metadata. */
const ApiErrorResponseZodDto = createZodDto(ApiErrorResponseSchema);

/** Swagger property metadata: one JSON-schema-like object per property, as nestjs-zod generates it. */
const DtoPropertyMetadataSchema = z.record(z.string(), JsonObjectSchema);
type DtoPropertyMetadata = Record<string, JsonObject>;

/** The envelope's metadata, generated on first use. The schema is fixed, so it never changes. */
let errorEnvelopeMetadata: DtoPropertyMetadata | undefined;

/**
 * Swagger component for the `{ success: false, error, meta }` error envelope
 * (ADR 016). Every response decorator (`@ZodResponse` & co., ADR 022)
 * documents `4XX` / `5XX` with it; add a specific
 * `@ApiResponse({ status: 409, type: ApiErrorResponseDto, description })`
 * where a particular failure deserves its own description.
 *
 * Success responses are NOT documented with DTO classes: they come from the
 * shared zod schema of each handler's response decorator.
 *
 * Swagger asks a DTO class for its properties on EVERY reference, and every
 * route references this one twice (4XX and 5XX): converting the schema each
 * time cost about a quarter of a second whenever the document was built. So
 * the conversion runs once, and each reference gets its own copy (Swagger
 * edits what it receives). Not a subclass of the nestjs-zod DTO: Swagger also
 * calls the factory of every parent class, which would convert the schema again.
 */
export class ApiErrorResponseDto {
	public static [SWAGGER_METADATA_FACTORY](): DtoPropertyMetadata {
		errorEnvelopeMetadata ??= DtoPropertyMetadataSchema.parse(ApiErrorResponseZodDto[SWAGGER_METADATA_FACTORY]());
		return structuredClone(errorEnvelopeMetadata);
	}
}
