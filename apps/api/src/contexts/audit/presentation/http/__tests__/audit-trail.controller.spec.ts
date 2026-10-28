import type { MessageEvent } from "@nestjs/common";
import { PATH_METADATA, SSE_METADATA } from "@nestjs/common/constants";
import { Reflector } from "@nestjs/core";
import { QueryBus } from "@nestjs/cqrs";
import { Test } from "@nestjs/testing";
import { API_VERSION_PREFIX, AuditTrailEntrySchema, AuditTrailListQuerySchema } from "@workspace/shared";
import { Subject, type Observable } from "rxjs";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import { AdminAccessOnly } from "../../../../../platform/presentation/http/security/decorators/admin-access.decorator";
import { getResponseContract } from "../../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { AUDIT_TRAIL_SIGNALS, type AuditTrailSignalsPort } from "../../../application/ports/audit-trail-signals.port";
import { ListAuditTrailQuery } from "../../../application/queries/list-audit-trail/list-audit-trail.query";
import { AUDIT_TRAIL_KEEPALIVE_MS, AUDIT_TRAIL_SIGNAL_THROTTLE_MS, AuditTrailController } from "../audit-trail.controller";
import { RecordingQueryBus } from "./recording-query-bus";
import { expectOwnMetadataLike, REQUIRED_PERMISSION_METADATA_KEY } from "./route-metadata";

const reflector = new Reflector();

const VIEWER: ActorContext = {
	kind: "user",
	userId: "99999999-9999-4999-8999-999999999999",
	sessionId: "session-1",
	tenantId: null,
	isSuperAdmin: true,
	accessScope: "tenant",
	impersonatorUserId: null,
	request: { requestId: "corr-view", ip: null, userAgent: null, deviceLabel: null, endpoint: null },
};

type HandlerName = "list" | "stream";

/** The decorated controller method (read off its property descriptor). */
function handlerOf(name: HandlerName): AuditTrailController[HandlerName] {
	const descriptor: TypedPropertyDescriptor<AuditTrailController[HandlerName]> | undefined = Object.getOwnPropertyDescriptor(AuditTrailController.prototype, name);
	const handler: AuditTrailController[HandlerName] | undefined = descriptor?.value;
	if (handler === undefined) {
		throw new Error(`AuditTrailController.${name} is not a method`);
	}
	return handler;
}

/** A class carrying exactly what `@AdminAccessOnly(...)` writes (applied as a call: spec files are not compiled with decorators). */
class ExpectedAdminAccess {}
AdminAccessOnly("Admin access required to view the audit log.")(ExpectedAdminAccess);

/** A signal source the test fires by hand. */
class ManualSignals implements AuditTrailSignalsPort {
	public constructor(private readonly signals: Subject<void>) {}

	public observe(): Observable<void> {
		return this.signals.asObservable();
	}
}

async function controllerWith(signals: Subject<void>, bus: RecordingQueryBus = new RecordingQueryBus()): Promise<AuditTrailController> {
	const moduleRef = await Test.createTestingModule({
		controllers: [AuditTrailController],
		providers: [
			{ provide: QueryBus, useValue: bus },
			{ provide: AUDIT_TRAIL_SIGNALS, useValue: new ManualSignals(signals) },
		],
	}).compile();
	return moduleRef.get(AuditTrailController);
}

describe("AuditTrailController authorization", () => {
	it("is served under the versioned admin prefix and needs admin-panel access", () => {
		expect(reflector.get<string>(PATH_METADATA, AuditTrailController)).toBe(`${API_VERSION_PREFIX}/admin/audit-trail`);
		expectOwnMetadataLike(AuditTrailController, ExpectedAdminAccess);
	});

	it("needs LIST AUDIT_LOG, and answers one page of timeline entries", () => {
		expect(reflector.get<readonly object[]>(REQUIRED_PERMISSION_METADATA_KEY, handlerOf("list"))).toEqual([{ action: "LIST", resource: "AUDIT_LOG" }]);
		expect(getResponseContract(handlerOf("list"))).toMatchObject({ kind: "paginated", schema: AuditTrailEntrySchema, status: 200 });
	});

	it("streams live updates under the same permission as the list, with no response contract", () => {
		expect(reflector.get<string>(PATH_METADATA, handlerOf("stream"))).toBe("events");
		expect(reflector.get<boolean>(SSE_METADATA, handlerOf("stream"))).toBe(true);
		expect(reflector.get<readonly object[]>(REQUIRED_PERMISSION_METADATA_KEY, handlerOf("stream"))).toEqual([{ action: "LIST", resource: "AUDIT_LOG" }]);
		expect(getResponseContract(handlerOf("stream"))).toBeUndefined();
	});
});

describe("AuditTrailController.list", () => {
	it("dispatches exactly one ListAuditTrailQuery with the actor and the validated query", async () => {
		const bus = new RecordingQueryBus();
		const query = AuditTrailListQuerySchema.parse({});

		await (await controllerWith(new Subject<void>(), bus)).list(VIEWER, query);

		expect(bus.executed).toEqual([new ListAuditTrailQuery(VIEWER, query)]);
	});
});

describe("AuditTrailController.stream", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("turns a burst of new entries into one frame now and one when it settles, never one per entry", async () => {
		vi.useFakeTimers();
		const signals = new Subject<void>();
		const frames: MessageEvent[] = [];
		const subscription = (await controllerWith(signals)).stream().subscribe((frame: MessageEvent): void => {
			frames.push(frame);
		});

		for (let entry = 0; entry < 5; entry += 1) {
			signals.next();
		}
		expect(frames).toHaveLength(1);
		await vi.advanceTimersByTimeAsync(AUDIT_TRAIL_SIGNAL_THROTTLE_MS);

		expect(frames).toHaveLength(2);
		expect(frames.every((frame: MessageEvent): boolean => frame.type === undefined)).toBe(true);
		subscription.unsubscribe();
	});

	it("pings an idle stream so proxies keep it open", async () => {
		vi.useFakeTimers();
		const frames: MessageEvent[] = [];
		const subscription = (await controllerWith(new Subject<void>())).stream().subscribe((frame: MessageEvent): void => {
			frames.push(frame);
		});

		await vi.advanceTimersByTimeAsync(AUDIT_TRAIL_KEEPALIVE_MS);

		expect(frames).toEqual([{ type: "ping", data: "" }]);
		subscription.unsubscribe();
	});
});
