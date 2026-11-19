import type { MessageEvent } from "@nestjs/common";
import {
	EmailLogListQuerySchema,
	LIST_SLOT_INDEX,
	type EmailLogEntry,
	type EmailLogListQuery,
	type EmailLogUpdatedEvent,
	type PaginatedServiceResult,
} from "@workspace/shared";
import { Subject, type Observable } from "rxjs";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { EmailLogReadPort } from "../../../application/ports/email-log-read.port";
import type { EmailLogSignalPort } from "../../../application/ports/email-log-signal.port";
import { EmailLogApplicationService } from "../../../application/services/email-log.application-service";
import { EmailLogController } from "../email-log.controller";

/** TEST-ONLY email log read model: an empty log, keeping each page asked for. */
class EmptyEmailLog implements EmailLogReadPort {
	public readonly asked: { readonly actor: ActorContext; readonly query: EmailLogListQuery }[] = [];

	public list(actor: ActorContext, query: EmailLogListQuery): Promise<PaginatedServiceResult<EmailLogEntry>> {
		this.asked.push({ actor, query });
		return Promise.resolve({ items: [], limit: 20, total: 0, page: 1, totalPages: 0, nextCursor: null, hasNext: false, hasPrevious: false });
	}
}

const serviceStub = new EmailLogApplicationService(new EmptyEmailLog());

/** TEST-ONLY signal: a plain Subject, so only subscribers present at emit time get a frame (the adapter's own spec covers its emitter). */
class SubjectEmailLogSignal implements EmailLogSignalPort {
	private readonly updates: Subject<EmailLogUpdatedEvent | null> = new Subject<EmailLogUpdatedEvent | null>();

	public emitUpdated(event?: EmailLogUpdatedEvent): void {
		this.updates.next(event ?? null);
	}

	public observeUpdates(): Observable<EmailLogUpdatedEvent | null> {
		return this.updates.asObservable();
	}
}

describe("EmailLogController (list)", () => {
	it("reads one page of the log through the email log application service, as the caller", async () => {
		const log = new EmptyEmailLog();
		const actor: ActorContext = { kind: "anonymous", tenantId: null, request: { requestId: "corr-1", ip: null, userAgent: null, deviceLabel: null, endpoint: null } };
		const query = EmailLogListQuerySchema.parse({});

		await expect(new EmailLogController(new EmailLogApplicationService(log), new SubjectEmailLogSignal()).list(actor, query)).resolves.toMatchObject({ items: [], total: 0 });
		expect(log.asked).toEqual([{ actor, query }]);
	});
});

describe("EmailLogController (SSE stream)", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("pushes a { updatedAt } frame for every update signal", () => {
		const events = new SubjectEmailLogSignal();
		const controller = new EmailLogController(serviceStub, events);
		const frames: MessageEvent[] = [];
		const subscription = controller.stream().subscribe((frame) => frames.push(frame));

		events.emitUpdated();
		events.emitUpdated();

		expect(frames).toHaveLength(2);
		expect(Object.keys(frames[LIST_SLOT_INDEX.first] ?? {})).toEqual(["data"]);
		expect(frames[LIST_SLOT_INDEX.first]?.data).toHaveProperty("updatedAt", expect.any(Number));

		subscription.unsubscribe();
	});

	it("stops pushing frames once the subscriber disconnects", () => {
		const events = new SubjectEmailLogSignal();
		const controller = new EmailLogController(serviceStub, events);
		const frames: MessageEvent[] = [];
		const subscription = controller.stream().subscribe((frame) => frames.push(frame));
		subscription.unsubscribe();

		events.emitUpdated();

		expect(frames).toHaveLength(0);
	});

	it("is cold: a frame is only delivered while subscribed", () => {
		const events = new SubjectEmailLogSignal();
		const controller = new EmailLogController(serviceStub, events);
		const frames: MessageEvent[] = [];

		// No subscription yet — an emit must be a no-op.
		events.emitUpdated();
		expect(frames).toHaveLength(0);

		const subscription = controller.stream().subscribe((frame) => frames.push(frame));
		events.emitUpdated();
		expect(frames).toHaveLength(1);
		subscription.unsubscribe();
	});

	it("emits a periodic keep-alive ping so idle streams survive proxies", () => {
		vi.useFakeTimers();
		const events = new SubjectEmailLogSignal();
		const controller = new EmailLogController(serviceStub, events);
		const frames: MessageEvent[] = [];
		const subscription = controller.stream().subscribe((frame) => frames.push(frame));

		// One 25s window elapses with zero writes — a typed `ping` frame must
		// arrive (it keeps the socket alive without being a data event).
		vi.advanceTimersByTime(25_000);

		expect(frames).toHaveLength(1);
		const [pingFrame] = frames;
		expect(pingFrame?.type).toBe("ping");
		expect(pingFrame?.data).toBe("");
		subscription.unsubscribe();
	});
});
