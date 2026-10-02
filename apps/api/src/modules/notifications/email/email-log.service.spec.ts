import { EmailLogListQuerySchema } from "@workspace/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RequestContextService } from "../../../common/context/request-context";
import { PlatformOutboxService } from "../../../infrastructure/outbox/platform-outbox.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { EmailLogEventsService } from "./email-log-events.service";
import { EmailLogRepository } from "./email-log.repository";
import { EmailLogService } from "./email-log.service";
import { createTestTypedConfig } from "../../../../test/support/test-api-env";

const { createMock, updateStatusByResendIdMock, countByResendIdMock, listMock, emitUpdatedMock, enqueueInTransactionMock } = vi.hoisted(() => ({
	createMock: vi.fn<EmailLogRepository["create"]>(),
	enqueueInTransactionMock: vi.fn<PlatformOutboxService["enqueueInTransaction"]>(),
	updateStatusByResendIdMock: vi.fn(),
	countByResendIdMock: vi.fn(),
	listMock: vi.fn(),
	emitUpdatedMock: vi.fn(),
}));

vi.mock("./email-log.repository", () => ({
	EmailLogRepository: class {
		public readonly create = createMock;
		public readonly updateStatusByResendId = updateStatusByResendIdMock;
		public readonly countByResendId = countByResendIdMock;
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

/** Sentinel for the repository's transaction client — the event must be written with exactly this client. */
const ROW_TX = new PrismaService(createTestTypedConfig());

describe("EmailLogService", () => {
	let service: EmailLogService;

	beforeEach(() => {
		vi.clearAllMocks();
		service = new EmailLogService(
			new EmailLogRepository(new PrismaService(createTestTypedConfig())),
			new EmailLogEventsService(),
			new PlatformOutboxService(new TenantTransactionService(new PrismaService(createTestTypedConfig())), new RequestContextService()),
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
			payload: { templateKey: "welcome", status: "sent", to: "a@b.com", resendId: "re-1", error: null, durationMs: null },
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

	it("applies a forward transition (sent row + delivered event) and reports 'updated'", async () => {
		updateStatusByResendIdMock.mockResolvedValue(1);
		const outcome = await service.updateStatusByResendId("re-9", "delivered");
		expect(outcome).toBe("updated");
		expect(emitUpdatedMock).toHaveBeenCalledTimes(1);
		// delivered is allowed from sent/delivered — plus bounced (soft-bounce recovery).
		expect(updateStatusByResendIdMock).toHaveBeenCalledWith("re-9", "delivered", ["sent", "delivered", "bounced"], undefined);
	});

	it("re-applying the same status is idempotent (delivered + delivered event)", async () => {
		updateStatusByResendIdMock.mockResolvedValue(1);
		const outcome = await service.updateStatusByResendId("re-9", "delivered");
		expect(outcome).toBe("updated");
		expect(updateStatusByResendIdMock).toHaveBeenCalledWith("re-9", "delivered", ["sent", "delivered", "bounced"], undefined);
	});

	it("allows delivered AFTER bounced (soft-bounce retry eventually succeeded)", async () => {
		updateStatusByResendIdMock.mockResolvedValue(1);
		const outcome = await service.updateStatusByResendId("re-9", "delivered");
		expect(outcome).toBe("updated");
		// "bounced" must stay in the allowed-source set for delivered.
		expect(updateStatusByResendIdMock).toHaveBeenCalledWith("re-9", "delivered", expect.arrayContaining(["bounced"]), undefined);
	});

	it("ignores a replayed event that would regress the status (delivered row + sent event) → 'stale'", async () => {
		updateStatusByResendIdMock.mockResolvedValue(0);
		countByResendIdMock.mockResolvedValue(1); // row exists, just not allowed to move backwards
		const outcome = await service.updateStatusByResendId("re-9", "sent");
		expect(outcome).toBe("stale");
		expect(emitUpdatedMock).not.toHaveBeenCalled();
		// sent is only allowed FROM sent — the where clause filters out progressed rows.
		expect(updateStatusByResendIdMock).toHaveBeenCalledWith("re-9", "sent", ["sent"], undefined);
	});

	it("never regresses a terminal status (complained row + delivered event) → 'stale'", async () => {
		updateStatusByResendIdMock.mockResolvedValue(0);
		countByResendIdMock.mockResolvedValue(1);
		const outcome = await service.updateStatusByResendId("re-9", "delivered");
		expect(outcome).toBe("stale");
		expect(emitUpdatedMock).not.toHaveBeenCalled();
	});

	it("reports 'not_found' for an email this system never sent (no row, no write)", async () => {
		updateStatusByResendIdMock.mockResolvedValue(0);
		countByResendIdMock.mockResolvedValue(0);
		const outcome = await service.updateStatusByResendId("spoofed-id", "bounced");
		expect(outcome).toBe("not_found");
		expect(emitUpdatedMock).not.toHaveBeenCalled();
		expect(updateStatusByResendIdMock).toHaveBeenCalledWith("spoofed-id", "bounced", ["sent", "delivered", "bounced"], undefined);
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
