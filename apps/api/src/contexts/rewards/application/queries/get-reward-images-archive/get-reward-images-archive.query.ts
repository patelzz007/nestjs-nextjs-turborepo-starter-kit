import { Query } from "@nestjs/cqrs";
import type { AdminRewardImagesArchivePathInput } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { RewardImagesArchive } from "../../ports/reward-read.port";

/** `GET /admin/rewards/:rewardId/images/archive`. */
export class GetRewardImagesArchiveQuery extends Query<RewardImagesArchive> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: AdminRewardImagesArchivePathInput,
	) {
		super();
	}
}
