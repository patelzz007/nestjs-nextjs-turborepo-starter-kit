import type { ExecutionContext } from "@nestjs/common";
import { SSE_METADATA } from "@nestjs/common/constants.js";
import type { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";

/** The media type of a Server-Sent Events stream. */
const EVENT_STREAM_ACCEPT = "text/event-stream";

/**
 * Whether the request is an event stream: an `@Sse()` handler, or a client asking for `text/event-stream`. Such a
 * response stays open for as long as the client listens, and its frames are written to the socket directly, so the
 * interceptors that envelope, time or end responses treat it apart.
 */
export function isEventStreamRequest(context: ExecutionContext, reflector: Reflector): boolean {
	const request: FastifyRequest = context.switchToHttp().getRequest<FastifyRequest>();
	// `includes` (not strict equality) tolerates `text/event-stream, */*` and Accept parameters.
	return request.headers.accept?.includes(EVENT_STREAM_ACCEPT) === true || reflector.get<boolean | undefined>(SSE_METADATA, context.getHandler()) === true;
}
