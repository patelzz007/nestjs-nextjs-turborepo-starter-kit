import { Inject, Injectable } from "@nestjs/common";
import type { AdminRewardImageDownloadResponse, AdminRewardImagePathInput, AdminRewardImagesArchivePathInput } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { RewardImageNotFoundError } from "../../domain/errors/reward.errors";
import type { RewardImageDeliveryPort, RewardImagesArchive } from "../ports/reward-read.port";
import { REWARD_IMAGE_DELIVERY } from "../ports/rewards.tokens";

/** The reviewer's downloads of a reward's original images (ADR 096). An image or reward the caller may not see is a 404. */
@Injectable()
export class RewardImageApplicationService {
	public constructor(@Inject(REWARD_IMAGE_DELIVERY) private readonly images: RewardImageDeliveryPort) {}

	/** A signed download link for one original image. */
	public async downloadUrl(actor: ActorContext, input: AdminRewardImagePathInput): Promise<AdminRewardImageDownloadResponse> {
		const download = await this.images.downloadUrl(actor, input.rewardId, input.fileId);
		if (download === null) {
			throw new RewardImageNotFoundError();
		}
		return download;
	}

	/** Every original image of the reward, as one archive (the stream stays in presentation). */
	public async archive(actor: ActorContext, input: AdminRewardImagesArchivePathInput): Promise<RewardImagesArchive> {
		const archive = await this.images.archive(actor, input.rewardId);
		if (archive === null) {
			throw new RewardImageNotFoundError();
		}
		return archive;
	}
}
