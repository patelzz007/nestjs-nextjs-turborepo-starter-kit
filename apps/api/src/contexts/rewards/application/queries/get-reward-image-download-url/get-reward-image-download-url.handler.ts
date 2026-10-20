import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { AdminRewardImageDownloadResponse } from "@workspace/shared";

import { RewardImageNotFoundError } from "../../../domain/errors/reward.errors";
import type { RewardImageDeliveryPort } from "../../ports/reward-read.port";
import { REWARD_IMAGE_DELIVERY } from "../../ports/rewards.tokens";
import { GetRewardImageDownloadUrlQuery } from "./get-reward-image-download-url.query";

/** A short-lived signed URL of one of a reward's original images; any other file id is 404, whoever owns it. */
@QueryHandler(GetRewardImageDownloadUrlQuery)
export class GetRewardImageDownloadUrlHandler implements IQueryHandler<GetRewardImageDownloadUrlQuery, AdminRewardImageDownloadResponse> {
	public constructor(@Inject(REWARD_IMAGE_DELIVERY) private readonly images: RewardImageDeliveryPort) {}

	public async execute(query: GetRewardImageDownloadUrlQuery): Promise<AdminRewardImageDownloadResponse> {
		const download = await this.images.downloadUrl(query.actor, query.input.rewardId, query.input.fileId);
		if (download === null) {
			throw new RewardImageNotFoundError();
		}
		return download;
	}
}
