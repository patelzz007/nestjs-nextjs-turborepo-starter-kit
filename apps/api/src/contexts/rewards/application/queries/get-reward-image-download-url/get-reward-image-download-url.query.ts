import { Query } from "@nestjs/cqrs";
import type { AdminRewardImageDownloadResponse, AdminRewardImagePathInput } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `GET /admin/rewards/:rewardId/images/:fileId/download`. */
export class GetRewardImageDownloadUrlQuery extends Query<AdminRewardImageDownloadResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: AdminRewardImagePathInput,
	) {
		super();
	}
}
