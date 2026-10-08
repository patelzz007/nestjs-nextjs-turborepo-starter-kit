import type { MessageEvent } from "@nestjs/common";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RequestContextService } from "../../../common/context/request-context";
import { PlatformOutboxService } from "../../../infrastructure/outbox/platform-outbox.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { EmailLogEventsService } from "./email-log-events.service";
import { EmailLogController } from "./email-log.controller";
import { EmailLogRepository } from "./email-log.repository";
import { EmailLogService } from "./email-log.service";
import { createTestTypedConfig } from "../../../../test/support/test-api-env";

vi.mock("../../../prisma/prisma.service", () => ({
	PrismaService: class {},
}));

// The stream() tests only exercise the SSE wiring, so the list service sits on
// an inert Prisma stub — the events service is real to prove the pub/sub bridge end to end.
const serviceStub = new EmailLogService(
	new EmailLogRepository(new PrismaService(createTestTypedConfig()), new TenantTransactionService(new PrismaService(createTestTypedConfig()), new RequestContextService())),
	new EmailLogEventsService(),
	new PlatformOutboxService(new TenantTransactionService(new PrismaService(createTestTypedConfig()), new RequestContextService()), new RequestContextService()),
);

describe("EmailLogController (SSE stream)", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("pushes a { updatedAt } frame for every update signal", () => {
		const events = new EmailLogEventsService();
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
		const events = new EmailLogEventsService();
		const controller = new EmailLogController(serviceStub, events);
		const frames: MessageEvent[] = [];
		const subscription = controller.stream().subscribe((frame) => frames.push(frame));
		subscription.unsubscribe();

		events.emitUpdated();

		expect(frames).toHaveLength(0);
	});

	it("is cold: a frame is only delivered while subscribed", () => {
		const events = new EmailLogEventsService();
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
		const events = new EmailLogEventsService();
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
