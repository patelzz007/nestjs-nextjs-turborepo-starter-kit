import { Injectable } from "@nestjs/common";
import { ReplaySubject, type Observable } from "rxjs";

/**
 * Signals that the HTTP server has started closing (Fastify's `preClose`, ADR 095). It emits once, and a stream that
 * subscribes after that sees it at once, so an event stream can never outlive the server.
 */
@Injectable()
export class HttpServerClosing {
	private readonly signal = new ReplaySubject<void>(1);

	/** Emits once, when the server starts closing. */
	public get closing(): Observable<void> {
		return this.signal.asObservable();
	}

	/** Called by the server's `preClose` hook; a second call changes nothing. */
	public begin(): void {
		this.signal.next();
		this.signal.complete();
	}
}
