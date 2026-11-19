import type { NestFastifyApplication } from "@nestjs/platform-fastify";

import { HttpServerClosing } from "../platform/presentation/http/lifecycle/http-server-closing";

/**
 * How the HTTP server closes during `app.close()` (ADR 095): every request in flight gets its answer, and the server
 * is closed as soon as the last one has gone out — never held open by an idle socket.
 *
 * - `preClose` (Fastify, the moment closing begins; from then on Fastify answers each new request with 503): fires
 *   {@link HttpServerClosing}, which ends every event stream (`EventStreamShutdownInterceptor`).
 * - `onSend` while closing: the response says `Connection: close`. Fastify marks only the requests that ARRIVE
 *   after closing began, so a request already in its handler would otherwise answer on a keep-alive connection
 *   that stays open, idle, until `keepAliveTimeout` (72 s) — and `server.close()` waits for it.
 * - `onResponse` while closing: closes the connections that are idle now. An event stream is written to the raw
 *   socket with `Connection: keep-alive`, so its connection is idle, not closed, once the stream has ended.
 *
 * Bootstrap calls it, and so does the e2e application factory (`createE2eAppWith`), so the e2e suite shuts down
 * the way production does.
 */
export function registerHttpShutdown(app: NestFastifyApplication): void {
	const server = app.getHttpAdapter().getInstance();
	const serverClosing: HttpServerClosing = app.get(HttpServerClosing);
	let closing = false;

	server.addHook("preClose", (done): void => {
		closing = true;
		serverClosing.begin();
		done();
	});

	server.addHook("onSend", (_request, reply, payload, done): void => {
		if (closing) {
			reply.header("connection", "close");
		}
		done(null, payload);
	});

	server.addHook("onResponse", (_request, _reply, done): void => {
		if (closing) {
			server.server.closeIdleConnections();
		}
		done();
	});
}
