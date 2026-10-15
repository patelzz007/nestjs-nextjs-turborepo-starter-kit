import { GUARDS_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { Reflector } from "@nestjs/core";
import { API_VERSION_PREFIX } from "@workspace/shared";
import type { MessageEvent } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Subject, type Observable } from "rxjs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { REQUIRED_PERMISSION_KEY } from "../authorization/constants/authorization.constants";
import { AdminAccessGuard } from "../auth/guards/admin-access.guard";
import { AUDIT_TRAIL_KEEPALIVE_MS, AUDIT_TRAIL_SIGNAL_THROTTLE_MS, AuditTrailController } from "./audit-trail.controller";
import { AuditTrailEventsService } from "./events/audit-trail-events.service";
import { AuditTrailQueryService } from "./services/audit-trail-query.service";

const reflector = new Reflector();

describe("AuditTrailController authorization", () => {
	it("is served under the versioned admin prefix and needs admin-panel access", () => {
		expect(reflector.get<string>(PATH_METADATA, AuditTrailController)).toBe(`${API_VERSION_PREFIX}/admin/audit-trail`);
		expect(reflector.get<object[]>(GUARDS_METADATA, AuditTrailController)).toEqual([AdminAccessGuard]);
	});

	it("needs LIST AUDIT_LOG", () => {
		const descriptor: TypedPropertyDescriptor<AuditTrailController["list"]> | undefined = Object.getOwnPropertyDescriptor(AuditTrailController.prototype, "list");
		const handler: AuditTrailController["list"] | undefined = descriptor?.value;
		if (handler === undefined) {
			throw new Error("AuditTrailController.list is not a method");
		}

		expect(reflector.get<object>(REQUIRED_PERMISSION_KEY, handler)).toEqual({ action: "LIST", resource: "AUDIT_LOG" });
	});

	it("streams live updates under the same permission as the list", () => {
		const descriptor: TypedPropertyDescriptor<AuditTrailController["stream"]> | undefined = Object.getOwnPropertyDescriptor(AuditTrailController.prototype, "stream");
		const handler: AuditTrailController["stream"] | undefined = descriptor?.value;
		if (handler === undefined) {
			throw new Error("AuditTrailController.stream is not a method");
		}

		expect(reflector.get<string>(PATH_METADATA, handler)).toBe("events");
		expect(reflector.get<object>(REQUIRED_PERMISSION_KEY, handler)).toEqual({ action: "LIST", resource: "AUDIT_LOG" });
	});
});

describe("AuditTrailController.stream", () => {
	async function controllerWith(signals: Subject<void>): Promise<AuditTrailController> {
		const moduleRef = await Test.createTestingModule({
			controllers: [AuditTrailController],
			providers: [
				{ provide: AuditTrailQueryService, useValue: {} },
				{ provide: AuditTrailEventsService, useValue: { observe: (): Observable<void> => signals.asObservable() } },
			],
		}).compile();
		return moduleRef.get(AuditTrailController);
	}

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
