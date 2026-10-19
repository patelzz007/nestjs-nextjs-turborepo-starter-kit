import { REWARD_IMAGES_ARCHIVE_CONTENT_TYPE, safeFileNameSegment, type AdminRewardImageDownloadResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { StoredFileAccess } from "../../../files/public-api";
import type { RewardImageDeliveryPort, RewardImagesArchive } from "../../application/ports/reward-read.port";
import type { RewardsReadSession } from "../persistence/rewards-read-session";

/** The archive name's reward segment when the title has no file-name-safe character. */
const REWARD_ARCHIVE_FALLBACK_NAME = "reward";

/**
 * Reviewers' downloads of a reward's original uploads, over the files context's signed URLs and
 * ZIP streaming. Reward images are READY before they can be attached, so a missing file here
 * means the reward/file pair is wrong, not that processing is pending.
 */
export class RewardImageDeliveryAdapter implements RewardImageDeliveryPort {
	public constructor(
		private readonly session: RewardsReadSession,
		private readonly files: StoredFileAccess,
	) {}

	public async downloadUrl(actor: ActorContext, rewardId: string, fileId: string): Promise<AdminRewardImageDownloadResponse | null> {
		const image = await this.session.readAcrossTenants(actor, async (db) =>
			db.rewardImage.findFirst({
				where: { rewardId, fileId, isDeleted: false, reward: { isDeleted: false, rewardKind: "CONSUMER" }, file: { isDeleted: false, status: "READY" } },
				select: { file: true },
			}),
		);
		if (image === null) {
			return null;
		}
		const download = await this.files.createDownloadUrl(image.file, "attachment");
		if (download.downloadUrl === null || download.expiresAt === null) {
			return null;
		}
		return { fileId: image.file.id, fileName: image.file.originalName, downloadUrl: download.downloadUrl, expiresAt: download.expiresAt };
	}

	public async archive(actor: ActorContext, rewardId: string): Promise<RewardImagesArchive | null> {
		const reward = await this.session.readAcrossTenants(actor, async (db) =>
			db.reward.findFirst({
				where: { id: rewardId, isDeleted: false, rewardKind: "CONSUMER" },
				select: {
					title: true,
					images: { where: { isDeleted: false, file: { isDeleted: false, status: "READY" } }, orderBy: { position: "asc" }, select: { file: true } },
				},
			}),
		);
		if (reward === null || reward.images.length === 0) {
			return null;
		}
		return {
			fileName: `${safeFileNameSegment(reward.title, REWARD_ARCHIVE_FALLBACK_NAME)}-photos.zip`,
			contentType: REWARD_IMAGES_ARCHIVE_CONTENT_TYPE,
			body: this.files.createZipArchive(reward.images.map((image) => image.file)),
		};
	}
}
