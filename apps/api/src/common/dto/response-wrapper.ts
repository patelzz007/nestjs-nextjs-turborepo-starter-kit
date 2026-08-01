import { ApiResponseMetaSchema } from "@workspace/shared";
import { createZodDto } from "nestjs-zod";
import { z } from "zod";

/**
 * Creates a ZodDto class that wraps a data schema in the standard
 * `{ success, data, meta }` response envelope.
 *
 * Use this in `@ApiOkResponse({ type: Wrapped(SomeSchema, "WrappedXxx") })`
 * so Swagger shows both the envelope AND the actual response data shape.
 *
 * @param dataSchema   — The Zod schema for the `data` field (e.g. `UserResponseSchema`)
 * @param className    — Unique class name for the generated DTO (e.g. `"WrappedMeResponse"`)
 *                      This ensures each endpoint gets a distinct OpenAPI component name.
 */
export function createWrappedDto(dataSchema: z.ZodType, className: string): ReturnType<typeof createZodDto<z.ZodObject<Record<string, z.ZodType>>>> {
	const envelopeSchema = z
		.object({
			success: z.literal(true).meta({
				description: "Indicates the request was successful",
				example: true,
			}),
			data: dataSchema.meta({
				description: "The response payload — structure varies by endpoint",
			}),
			meta: ApiResponseMetaSchema,
		})
		.strict();

	const WrappedResponseDto = createZodDto(envelopeSchema);

	// Override the class name so @nestjs/swagger registers it as a distinct component
	Object.defineProperty(WrappedResponseDto, "name", {
		value: className,
		configurable: true,
	});

	return WrappedResponseDto;
}

/**
 * Convenience wrapper for array-typed responses.
 *
 * @example createWrappedArrayDto(SessionSchema, "WrappedSessionList")
 *          → { success, data: Session[], meta }
 */
export function createWrappedArrayDto(itemSchema: z.ZodType, className: string): ReturnType<typeof createZodDto<z.ZodObject<Record<string, z.ZodType>>>> {
	const envelopeSchema = z
		.object({
			success: z.literal(true).meta({
				description: "Indicates the request was successful",
				example: true,
			}),
			data: z.array(itemSchema).meta({
				description: "Array of response items — structure varies by endpoint",
			}),
			meta: ApiResponseMetaSchema,
		})
		.strict();

	const WrappedArrayResponseDto = createZodDto(envelopeSchema);

	Object.defineProperty(WrappedArrayResponseDto, "name", {
		value: className,
		configurable: true,
	});

	return WrappedArrayResponseDto;
}
