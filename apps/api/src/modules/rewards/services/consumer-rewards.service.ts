import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import type { RewardListQuery, RewardResponse } from "@workspace/shared";

import { PrismaService } from "../../../prisma/prisma.service";
import { mapRewardToResponse } from "../utils/reward-mapper.util";

@Injectable()
export class ConsumerRewardsService {
	public constructor(private readonly prisma: PrismaService) {}

	public async listMarketplace(query: RewardListQuery): Promise<{
		items: RewardResponse[];
		total: number;
		page: number;
		limit: number;
		totalPages: number;
		hasNext: boolean;
		hasPrevious: boolean;
	}> {
		const page = query.page;
		const pageSize = query.limit;
		const skip = (page - 1) * pageSize;

		const where: Prisma.RewardWhereInput = {
			isDeleted: false,
			status: "PUBLISHED",
			rewardKind: "CONSUMER",
			...(query.category !== undefined ? { category: query.category } : {}),
			...(query.search !== undefined
				? {
						OR: [{ title: { contains: query.search, mode: "insensitive" } }, { description: { contains: query.search, mode: "insensitive" } }],
					}
				: {}),
			...(query.city !== undefined
				? {
						merchantOrg: { city: query.city },
					}
				: {}),
		};

		const [rows, total] = await this.prisma.$transaction([
			this.prisma.reward.findMany({
				where,
				include: { merchantOrg: { select: { businessName: true } } },
				orderBy: { createdAt: "desc" },
				skip,
				take: pageSize,
			}),
			this.prisma.reward.count({ where }),
		]);

		return {
			items: rows.map((row) => mapRewardToResponse(row, row.merchantOrg)),
			total,
			page,
			limit: pageSize,
			totalPages: pageSize === 0 ? 0 : Math.ceil(total / pageSize),
			hasNext: page * pageSize < total,
			hasPrevious: page > 1,
		};
	}

	public async getPublishedReward(rewardId: string): Promise<RewardResponse> {
		const reward = await this.prisma.reward.findFirst({
			where: {
				id: rewardId,
				isDeleted: false,
				status: "PUBLISHED",
				rewardKind: "CONSUMER",
			},
			include: { merchantOrg: { select: { businessName: true } } },
		});

		if (reward === null) {
			throw new NotFoundException({ message: "Reward not found", error: "REWARD_NOT_FOUND" });
		}

		return mapRewardToResponse(reward, reward.merchantOrg);
	}
}
