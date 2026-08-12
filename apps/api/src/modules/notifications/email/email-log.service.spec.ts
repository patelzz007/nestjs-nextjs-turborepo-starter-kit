import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EmailLogEventsService } from "./email-log-events.service.js";
import { EmailLogService } from "./email-log.service.js";

const createMock = vi.fn();
const updateManyMock = vi.fn();
const findManyMock = vi.fn();
const countMock = vi.fn();
const emitUpdatedMock = vi.fn();

const prismaMock = {
	emailLog: {
		create: createMock,
		updateMany: updateManyMock,
		findMany: findManyMock,
		count: countMock,
	},
} as never;

const eventsMock = {
	emitUpdated: emitUpdatedMock,
} as unknown as EmailLogEventsService;

describe("EmailLogService", () => {
	let service: EmailLogService;

	beforeEach(() => {
		vi.clearAllMocks();
		service = new EmailLogService(prismaMock, eventsMock);
	});

	it("creates a row and returns its id", async () => {
		createMock.mockResolvedValue({ id: "row-1" });
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
				data: expect.objectContaining({ templateKey: "welcome", status: "sent", resendId: "re-1" }),
				select: { id: true },
			}),
		);
	});

	it("rejects malformed emails via the create schema", async () => {
		await expect(service.create({ templateKey: "welcome", to: "nope", subject: "x", status: "sent" })).rejects.toThrow();
		expect(createMock).not.toHaveBeenCalled();
		expect(emitUpdatedMock).not.toHaveBeenCalled();
	});

	it("applies a forward transition (sent row + delivered event) and reports 'updated'", async () => {
		updateManyMock.mockResolvedValue({ count: 1 });
		const outcome = await service.updateStatusByResendId("re-9", "delivered");
		expect(outcome).toBe("updated");
		expect(emitUpdatedMock).toHaveBeenCalledTimes(1);
		expect(updateManyMock).toHaveBeenCalledWith(
			expect.objectContaining({
				// delivered is allowed from sent/delivered — plus bounced (soft-bounce recovery).
				where: { resendId: "re-9", status: { in: ["sent", "delivered", "bounced"] } },
				data: expect.objectContaining({ status: "delivered" }),
			}),
		);
	});

	it("re-applying the same status is idempotent (delivered + delivered event)", async () => {
		updateManyMock.mockResolvedValue({ count: 1 });
		const outcome = await service.updateStatusByResendId("re-9", "delivered");
		expect(outcome).toBe("updated");
		expect(updateManyMock).toHaveBeenCalledWith(
			expect.objectContaining({ where: { resendId: "re-9", status: { in: ["sent", "delivered", "bounced"] } } }),
		);
	});

	it("allows delivered AFTER bounced (soft-bounce retry eventually succeeded)", async () => {
		updateManyMock.mockResolvedValue({ count: 1 });
		const outcome = await service.updateStatusByResendId("re-9", "delivered");
		expect(outcome).toBe("updated");
	});

	it("ignores a replayed event that would regress the status (delivered row + sent event) → 'stale'", async () => {
		updateManyMock.mockResolvedValue({ count: 0 });
		countMock.mockResolvedValue(1); // row exists, just not allowed to move backwards
		const outcome = await service.updateStatusByResendId("re-9", "sent");
		expect(outcome).toBe("stale");
		expect(emitUpdatedMock).not.toHaveBeenCalled();
		// sent is only allowed FROM sent — a delivered row is filtered out by the where.
		expect(updateManyMock).toHaveBeenCalledWith(
			expect.objectContaining({ where: { resendId: "re-9", status: { in: ["sent"] } } }),
		);
	});

	it("never regresses a terminal status (complained row + delivered event) → 'stale'", async () => {
		updateManyMock.mockResolvedValue({ count: 0 });
		countMock.mockResolvedValue(1);
		const outcome = await service.updateStatusByResendId("re-9", "delivered");
		expect(outcome).toBe("stale");
		expect(emitUpdatedMock).not.toHaveBeenCalled();
	});

	it("reports 'not_found' for an email this system never sent (no row, no write)", async () => {
		updateManyMock.mockResolvedValue({ count: 0 });
		countMock.mockResolvedValue(0);
		const outcome = await service.updateStatusByResendId("spoofed-id", "bounced");
		expect(outcome).toBe("not_found");
		expect(emitUpdatedMock).not.toHaveBeenCalled();
		expect(updateManyMock).toHaveBeenCalledWith(
			expect.objectContaining({ where: expect.objectContaining({ resendId: "spoofed-id" }) }),
		);
	});

	it("maps recent rows to the wire contract (ISO dates, no tracking fields)", async () => {
		const createdAt = new Date("2026-08-11T10:00:00.000Z");
		findManyMock.mockResolvedValue([
			{
				id: "row-1",
				templateKey: "welcome",
				to: "a@b.com",
				subject: "Welcome",
				status: "delivered",
				resendId: "re-1",
				error: null,
				metadata: { staleTrackingKey: "x" },
				createdAt,
				updatedAt: createdAt,
			},
		]);
		const rows = await service.listRecent(10);
		expect(rows[0]).toEqual(
			expect.objectContaining({
				id: "row-1",
				templateKey: "welcome",
				status: "delivered",
				resendId: "re-1",
				createdAt: createdAt.toISOString(),
				updatedAt: createdAt.toISOString(),
			}),
		);
		// Tracking fields are gone from the wire contract.
		expect(rows[0]).not.toHaveProperty("openUserAgent");
		expect(rows[0]).not.toHaveProperty("openedAt");
		expect(rows[0]).not.toHaveProperty("clickedAt");
	});
});
