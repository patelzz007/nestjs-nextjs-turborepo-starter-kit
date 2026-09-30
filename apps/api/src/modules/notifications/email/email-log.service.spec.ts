import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../../prisma/prisma.service";
import { EmailLogEventsService } from "./email-log-events.service";
import { EmailLogRepository } from "./email-log.repository";
import { EmailLogService } from "./email-log.service";

const { createMock, updateStatusByResendIdMock, countByResendIdMock, listRecentMock, emitUpdatedMock } = vi.hoisted(() => ({
	createMock: vi.fn(),
	updateStatusByResendIdMock: vi.fn(),
	countByResendIdMock: vi.fn(),
	listRecentMock: vi.fn(),
	emitUpdatedMock: vi.fn(),
}));

vi.mock("./email-log.repository", () => ({
	EmailLogRepository: class {
		public readonly create = createMock;
		public readonly updateStatusByResendId = updateStatusByResendIdMock;
		public readonly countByResendId = countByResendIdMock;
		public readonly listRecent = listRecentMock;
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

describe("EmailLogService", () => {
	let service: EmailLogService;

	beforeEach(() => {
		vi.clearAllMocks();
		service = new EmailLogService(new EmailLogRepository(new PrismaService()), new EmailLogEventsService());
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
				templateKey: "welcome",
				to: "a@b.com",
				subject: "Welcome aboard!",
				status: "sent",
				resendId: "re-1",
			}),
		);
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

	it("maps recent rows to the wire contract (epoch dates, no tracking fields)", async () => {
		const createdAt = Date.parse("2026-08-11T10:00:00.000Z");
		const updatedAt = createdAt;
		listRecentMock.mockResolvedValue([
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
				createdAt,
				updatedAt,
			}),
		);
		// Tracking fields are gone from the wire contract.
		expect(rows[0]).not.toHaveProperty("openUserAgent");
		expect(rows[0]).not.toHaveProperty("openedAt");
		expect(rows[0]).not.toHaveProperty("clickedAt");
	});
});
