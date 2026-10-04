import { EmailLogListQuerySchema, type EmailLogStatus } from "@workspace/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RequestContextService } from "../../../common/context/request-context";
import { PlatformOutboxService } from "../../../infrastructure/outbox/platform-outbox.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { EmailLogEventsService } from "./email-log-events.service";
import { EmailLogRepository } from "./email-log.repository";
import { EmailLogService, type DeliveryWebhookEvent } from "./email-log.service";
import { createTestTypedConfig } from "../../../../test/support/test-api-env";

const { createMock, finalizeSentMock, finalizeFailedMock, recordDeliveryEventMock, listMock, emitUpdatedMock, enqueueInTransactionMock } = vi.hoisted(() => ({
	createMock: vi.fn<EmailLogRepository["create"]>(),
	enqueueInTransactionMock: vi.fn<PlatformOutboxService["enqueueInTransaction"]>(),
	finalizeSentMock: vi.fn<EmailLogRepository["finalizeSent"]>(),
	finalizeFailedMock: vi.fn<EmailLogRepository["finalizeFailed"]>(),
	recordDeliveryEventMock: vi.fn<EmailLogRepository["recordDeliveryEvent"]>(),
	listMock: vi.fn(),
	emitUpdatedMock: vi.fn(),
}));

vi.mock("./email-log.repository", () => ({
	EmailLogRepository: class {
		public readonly create = createMock;
		public readonly finalizeSent = finalizeSentMock;
		public readonly finalizeFailed = finalizeFailedMock;
		public readonly recordDeliveryEvent = recordDeliveryEventMock;
		public readonly list = listMock;
	},
}));

vi.mock("./email-log-events.service", () => ({
	EmailLogEventsService: class {
		public readonly emitUpdated = emitUpdatedMock;
	},
}));

vi.mock("../../../prisma/prisma.service", () => ({
	PrismaService: class {},
}));

vi.mock("../../../infrastructure/outbox/platform-outbox.service", () => ({
	PlatformOutboxService: class {
		public readonly enqueueInTransaction = enqueueInTransactionMock;
	},
}));

const DELIVERY_EVENT: DeliveryWebhookEvent = {
	webhookId: "msg_1",
	eventType: "email.delivered",
	resendId: "re-9",
	taggedEmailLogId: undefined,
	status: "delivered",
	detail: undefined,
	occurredAt: 1_790_812_800_000,
};

/** Sentinel for the repository's transaction client — the event must be written with exactly this client. */
const ROW_TX = new PrismaService(createTestTypedConfig());

describe("EmailLogService", () => {
	let service: EmailLogService;

	beforeEach(() => {
		vi.clearAllMocks();
		service = new EmailLogService(
			new EmailLogRepository(
				new PrismaService(createTestTypedConfig()),
				new TenantTransactionService(new PrismaService(createTestTypedConfig()), new RequestContextService()),
			),
			new EmailLogEventsService(),
			new PlatformOutboxService(new TenantTransactionService(new PrismaService(createTestTypedConfig()), new RequestContextService()), new RequestContextService()),
		);
		// The repository runs the caller's same-transaction write inside its transaction.
		createMock.mockImplementation(async (_input, withinTransaction): Promise<{ readonly id: string }> => {
			await withinTransaction(ROW_TX);
			return { id: "row-1" };
		});
		enqueueInTransactionMock.mockResolvedValue("evt-1");
	});

	it("creates a row and returns its id", async () => {
		const result = await service.create({
			templateKey: "welcome",
			to: "a@b.com",
			subject: "Welcome aboard!",
			status: "sent",
			resendId: "re-1",
		});
		expect(result.id).toBe("row-1");
		expect(emitUpdatedMock).toHaveBeenCalledTimes(1);
		expect(createMock).toHaveBeenCalledWith(
			expect.objectContaining({
				templateKey: "welcome",
				to: "a@b.com",
				subject: "Welcome aboard!",
				status: "sent",
				resendId: "re-1",
			}),
			expect.any(Function),
		);
	});

	it("writes the email.log.updated event in the SAME transaction as the row", async () => {
		await service.create({ templateKey: "welcome", to: "a@b.com", subject: "Welcome aboard!", status: "sent", resendId: "re-1" });

		expect(enqueueInTransactionMock).toHaveBeenCalledWith(ROW_TX, {
			type: "email.log.updated",
			payload: { templateKey: "welcome", status: "sent", resendId: "re-1", error: null, durationMs: null },
		});
	});

	it("does not signal the SSE stream when the row + event transaction fails", async () => {
		createMock.mockRejectedValue(new Error("insert failed"));

		await expect(service.create({ templateKey: "welcome", to: "a@b.com", subject: "Welcome aboard!", status: "sent" })).rejects.toThrow("insert failed");

		expect(emitUpdatedMock).not.toHaveBeenCalled();
	});

	it("rejects malformed emails via the create schema", async () => {
		await expect(service.create({ templateKey: "welcome", to: "nope", subject: "x", status: "sent" })).rejects.toThrow();
		expect(createMock).not.toHaveBeenCalled();
		expect(emitUpdatedMock).not.toHaveBeenCalled();
	});

	it("does not emit an outcome event for a pending row — the outcome will", async () => {
		await service.create({ templateKey: "welcome", to: "a@b.com", subject: "Welcome aboard!", status: "pending" });

		expect(enqueueInTransactionMock).not.toHaveBeenCalled();
	});

	it("finalizes a sent attempt once, with its event in the finalize transaction", async () => {
		finalizeSentMock.mockImplementation(async (_id, _resendId, onFinalized): Promise<boolean> => {
			await onFinalized(ROW_TX);
			return true;
		});

		await expect(service.finalizeSent("row-1", { templateKey: "welcome", to: "a@b.com" }, "re-1", 12)).resolves.toBe(true);

		expect(enqueueInTransactionMock).toHaveBeenCalledWith(ROW_TX, {
			type: "email.log.updated",
			payload: { templateKey: "welcome", status: "sent", resendId: "re-1", error: null, durationMs: 12 },
		});
		expect(emitUpdatedMock).toHaveBeenCalledTimes(1);
	});

	it("emits nothing when another writer already finalized the attempt", async () => {
		finalizeFailedMock.mockResolvedValue(false);

		await expect(service.finalizeFailed("row-1", { templateKey: "welcome", to: "a@b.com" }, "boom", null)).resolves.toBe(false);

		expect(emitUpdatedMock).not.toHaveBeenCalled();
	});

	it.each([
		["sent", ["pending", "sent"]],
		["delivered", ["pending", "sent", "delivered", "bounced"]],
		["complained", ["pending", "sent", "delivered", "bounced", "complained"]],
	] satisfies [EmailLogStatus, EmailLogStatus[]][])("applies a %s event only from its forward-allowed statuses", async (status, allowedFrom) => {
		recordDeliveryEventMock.mockResolvedValue({ kind: "recorded", outcome: "applied" });

		await service.applyDeliveryEvent({ ...DELIVERY_EVENT, status });

		expect(recordDeliveryEventMock).toHaveBeenCalledWith({ ...DELIVERY_EVENT, status, allowedFrom });
		expect(emitUpdatedMock).toHaveBeenCalledTimes(1);
	});

	it("signals the admin stream only when an event was applied", async () => {
		recordDeliveryEventMock.mockResolvedValueOnce({ kind: "recorded", outcome: "stale" }).mockResolvedValueOnce({ kind: "duplicate" });

		await expect(service.applyDeliveryEvent(DELIVERY_EVENT)).resolves.toEqual({ kind: "recorded", outcome: "stale" });
		await expect(service.applyDeliveryEvent(DELIVERY_EVENT)).resolves.toEqual({ kind: "duplicate" });

		expect(emitUpdatedMock).not.toHaveBeenCalled();
	});

	it("passes no allowed statuses for an event that maps to none (tracking events are only recorded)", async () => {
		recordDeliveryEventMock.mockResolvedValue({ kind: "recorded", outcome: "ignored" });

		await service.applyDeliveryEvent({ ...DELIVERY_EVENT, eventType: "email.opened", status: undefined });

		expect(recordDeliveryEventMock).toHaveBeenCalledWith(expect.objectContaining({ status: undefined, allowedFrom: [] }));
	});

	it("maps a list page to the wire contract (epoch dates, no tracking fields) and keeps the pagination", async () => {
		const createdAt = Date.parse("2026-08-11T10:00:00.000Z");
		const updatedAt = createdAt;
		listMock.mockResolvedValue({
			items: [
				{
					id: "row-1",
					templateKey: "welcome",
					to: "a@b.com",
					subject: "Welcome",
					status: "delivered",
					resendId: "re-1",
					error: null,
					metadata: { staleTrackingKey: "x" },
					createdAt: BigInt(createdAt),
					updatedAt: BigInt(createdAt),
				},
			],
			total: 11,
			page: 1,
			totalPages: 2,
			nextCursor: "next",
			hasNext: true,
			hasPrevious: false,
		});
		const query = EmailLogListQuerySchema.parse({ limit: "10" });
		const result = await service.list(query);
		expect(listMock).toHaveBeenCalledWith(query);
		expect(result).toEqual(expect.objectContaining({ limit: 10, total: 11, page: 1, totalPages: 2, nextCursor: "next", hasNext: true, hasPrevious: false }));
		const [row] = result.items;
		expect(row).toEqual(
			expect.objectContaining({
				id: "row-1",
				templateKey: "welcome",
				status: "delivered",
				resendId: "re-1",
				createdAt,
				updatedAt,
			}),
		);
		// Tracking fields are gone from the wire contract.
		expect(row).not.toHaveProperty("openUserAgent");
		expect(row).not.toHaveProperty("openedAt");
		expect(row).not.toHaveProperty("clickedAt");
	});
});
