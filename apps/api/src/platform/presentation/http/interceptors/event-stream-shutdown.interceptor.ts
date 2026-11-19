import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { takeUntil, type Observable } from "rxjs";

import { isEventStreamRequest } from "../event-stream-request";
import { HttpServerClosing } from "../lifecycle/http-server-closing";

/**
 * Ends every event stream (`@Sse()`) when the HTTP server starts closing.
 *
 * An event stream never finishes on its own (a keep-alive `ping` interval keeps it open for as long as the client
 * listens), so without this a graceful shutdown waited on every open browser tab until the shutdown timeout cut it.
 * The client's `EventSource` reconnects, and since Fastify answers every request that arrives while closing with
 * 503, it reaches another instance (ADR 095).
 */
@Injectable()
export class EventStreamShutdownInterceptor implements NestInterceptor {
	public constructor(
		private readonly reflector: Reflector,
		private readonly server: HttpServerClosing,
	) {}

	public intercept<T>(context: ExecutionContext, next: CallHandler<T>): Observable<T> {
		if (!isEventStreamRequest(context, this.reflector)) {
			return next.handle();
		}
		return next.handle().pipe(takeUntil(this.server.closing));
	}
}
