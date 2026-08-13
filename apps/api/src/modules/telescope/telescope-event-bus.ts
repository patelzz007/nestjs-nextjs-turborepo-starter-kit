import { Injectable } from "@nestjs/common";
import { Subject } from "rxjs";

import type { TelescopeStreamEvent } from "@workspace/shared";

/**
 * Publish/subscribe bus for the live stream (improvement 2 — SSE). The
 * capture interceptor publishes after a request/exception lands in the store;
 * the `GET /telescope/stream` SSE handler subscribes. A plain `Subject`
 * (not `BehaviorSubject`) is right: clients only care about events that
 * happen WHILE they are connected — a late joiner gets the next event, not
 * a replay of history (they can always fetch the current state via the REST
 * endpoints).
 */
@Injectable()
// eslint-disable-next-line @darraghor/nestjs-typed/injectable-should-be-provided -- Registered in TelescopeModule.register()'s dynamic providers; the typed plugin only scans static @Module decorators.
export class TelescopeEventBus {
	private readonly events$: Subject<TelescopeStreamEvent> = new Subject<TelescopeStreamEvent>();

	/** Called by the capture pipeline after a store write. */
	public publish(event: TelescopeStreamEvent): void {
		this.events$.next(event);
	}

	/** The observable the `@Sse()` handler maps into `MessageEvent` frames. */
	public subscribe(): Subject<TelescopeStreamEvent> {
		return this.events$;
	}
}
