import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RewardNotification } from "@prisma/client";
import { epochMs, RewardNotificationListQuerySchema, RewardNotificationListResponseSchema, type RewardNotificationListResponse } from "@workspace/shared";

import { createTestPrisma } from "../../../../test/support/test-service-graph";
import { RewardNotificationRepository } from "../repositories/reward-notification.repository";
import { RewardNotificationService } from "./reward-notification.service";

const mocks = vi.hoisted(() => ({
	listForUser: vi.fn(),
}));

vi.mock("../repositories/reward-notification.repository", () => ({
	RewardNotificationRepository: class {
		public readonly listForUser = mocks.listForUser;
	},
}));

const CREATED_AT_MS = 1_786_300_000_000;
const READ_AT_MS = 1_786_300_060_000;
const UNREAD_COUNT = 3;
const PAGE_TOTAL = 2;
const NEXT_CURSOR = "cursor-2";

const USER_ID = "5d0c9a8b-7e6f-4a3b-9c2d-1e0f9a8b7c6d";

function row(id: string, readAtMs: number | null): RewardNotification {
	return {
		id,
		userId: USER_ID,
		type: "claim.created",
		title: "Reward claimed",
		body: "Show the QR code at the counter",
		metadata: { rewardId: "reward-1" },
		readAt: readAtMs === null ? null : BigInt(readAtMs),
		isDeleted: false,
		deletedAt: null,
		createdAt: BigInt(CREATED_AT_MS),
		updatedAt: BigInt(CREATED_AT_MS),
	};
}

const service = (): RewardNotificationService => new RewardNotificationService(new RewardNotificationRepository(createTestPrisma()));

describe("RewardNotificationService.listForUser", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("maps a repository page (bigint epochs, JSON metadata) to the RewardNotificationListResponse contract", async () => {
		const unreadId = "8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
		const readId = "1f2e3d4c-5b6a-4978-8a9b-0c1d2e3f4a5b";
		mocks.listForUser.mockResolvedValue({
			page: { items: [row(unreadId, null), row(readId, READ_AT_MS)], total: PAGE_TOTAL, page: 1, totalPages: 1, nextCursor: NEXT_CURSOR, hasNext: true, hasPrevious: false },
			unreadCount: UNREAD_COUNT,
		});
		const query = RewardNotificationListQuerySchema.parse({});

		const result: RewardNotificationListResponse = await service().listForUser(USER_ID, query);

		const base = {
			type: "claim.created",
			title: "Reward claimed",
			body: "Show the QR code at the counter",
			metadata: { rewardId: "reward-1" },
			createdAt: epochMs(CREATED_AT_MS),
			updatedAt: epochMs(CREATED_AT_MS),
			isDeleted: false,
			deletedAt: null,
		};
		expect(result).toEqual({
			items: [
				{ ...base, id: unreadId, readAt: null },
				{ ...base, id: readId, readAt: epochMs(READ_AT_MS) },
			],
			unreadCount: UNREAD_COUNT,
			nextCursor: NEXT_CURSOR,
			hasNext: true,
		});
		// The response contract the interceptor enforces accepts the payload unchanged.
		expect(RewardNotificationListResponseSchema.parse(result)).toEqual(result);
		expect(mocks.listForUser).toHaveBeenCalledWith(USER_ID, query);
	});
});
