import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";

import { RewardImageNotFoundError } from "../../../domain/errors/reward.errors";
import type { RewardImageDeliveryPort, RewardImagesArchive } from "../../ports/reward-read.port";
import { REWARD_IMAGE_DELIVERY } from "../../ports/rewards.tokens";
import { GetRewardImagesArchiveQuery } from "./get-reward-images-archive.query";

/** Every image of a reward as one ZIP; no such reward, or one with no image, is 404 before a byte is sent. */
@QueryHandler(GetRewardImagesArchiveQuery)
export class GetRewardImagesArchiveHandler implements IQueryHandler<GetRewardImagesArchiveQuery, RewardImagesArchive> {
	public constructor(@Inject(REWARD_IMAGE_DELIVERY) private readonly images: RewardImageDeliveryPort) {}

	public async execute(query: GetRewardImagesArchiveQuery): Promise<RewardImagesArchive> {
		const archive = await this.images.archive(query.actor, query.input.rewardId);
		if (archive === null) {
			throw new RewardImageNotFoundError();
		}
		return archive;
	}
}
