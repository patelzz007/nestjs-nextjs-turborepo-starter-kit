import { applyDecorators } from "@nestjs/common";
import { ApiOkResponse, ApiProduces } from "@nestjs/swagger";

/** The media type of a Server-Sent Events stream. */
export const EVENT_STREAM_MEDIA_TYPE = "text/event-stream";

/**
 * Documents an `@Sse()` endpoint: it produces `text/event-stream` (not the JSON
 * envelope), so the OpenAPI export — and the API reference generated from it —
 * names that media type instead of defaulting to `application/json`.
 */
export function ApiEventStreamResponse(description: string): MethodDecorator {
	return applyDecorators(ApiProduces(EVENT_STREAM_MEDIA_TYPE), ApiOkResponse({ description, content: { [EVENT_STREAM_MEDIA_TYPE]: { schema: { type: "string" } } } }));
}
